"use strict";

function parsePacketDiag(source, overrides) {
  const ov = overrides || {};
  const text = extractPacketSource(source);
  const lines = text.split(/\r?\n/);
  const config = {
    colwidth: 32,
    node_height: 72,
    default_fontsize: 12,
    bit_order: "asc",
    numbering: "global"
  };
  const sections = [];
  const descTableEntries = [];
  const warnings = [];
  let currentSection = createSection("");
  let pendingRowLabel = "";
  let pendingRowNote = "";
  let hasBody = false;
  let localRowIndex = 0;
  let inDescTable = false;
  let explicitRowMode = false;
  let currentExplicitRow = null;

  function finishSection() {
    if (currentSection.fields.length > 0 || currentSection.name) {
      sections.push(currentSection);
    }
    currentSection = createSection("");
    localRowIndex = 0;
    explicitRowMode = false;
    currentExplicitRow = null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const originalLine = lines[index];
    const comment = readLineComment(originalLine);
    let line = stripLineComment(originalLine).trim();
    let inlineLeftNote = "";

    if (line === "packetdiag {" || line === "packetdiag{" || /^@startpacketdiag\b/i.test(line)) {
      hasBody = true;
      continue;
    }

    if (line === "}" || /^@endpacketdiag\b/i.test(originalLine.trim())) {
      if (inDescTable) {
        inDescTable = false;
      }
      continue;
    }

    // desctable block
    if (/^desctable\b/i.test(line)) {
      inDescTable = true;
      hasBody = true;
      line = line.replace(/^desctable\s*\{?\s*/i, "").replace(/}\s*$/, "").trim();
      if (line === "") {
        continue;
      }
    }

    if (inDescTable) {
      let closingDescTable = false;
      if (line.endsWith("}")) {
        line = line.slice(0, -1).trim();
        closingDescTable = true;
      }
      const dtMatch = line.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
      if (dtMatch) {
        descTableEntries.push({
          label: dtMatch[1],
          description: parseValue(dtMatch[2].replace(/;\s*$/, ""))
        });
      }
      if (closingDescTable) {
        inDescTable = false;
      }
      continue;
    }

    if (comment) {
      const leftNote = parseLeftNote(comment);
      const atRowLabel = parseAtRow(comment);
      const sectionName = (!leftNote && atRowLabel === null) ? parseSectionComment(comment) : "";

      if (atRowLabel !== null) {
        localRowIndex += 1;
        explicitRowMode = true;
        currentExplicitRow = localRowIndex;
        pendingRowLabel = atRowLabel || "";
      } else if (leftNote && line === "") {
        pendingRowNote = appendNote(pendingRowNote, leftNote);
      } else if (leftNote) {
        inlineLeftNote = leftNote;
      } else if (sectionName) {
        finishSection();
        currentSection.name = sectionName;
      } else if (line === "" && isUsefulRowLabel(comment)) {
        pendingRowLabel = comment;
      }
    }

    if (line === "") {
      continue;
    }

    const configMatch = line.match(/^([A-Za-z_]\w*)\s*=\s*(.+?)\s*;?$/);
    if (configMatch) {
      const key = configMatch[1];
      const value = parseValue(configMatch[2]);
      config[key] = value;
      continue;
    }

    const field = parseFieldLine(line, index + 1);
    if (field) {
      const numbering = config.numbering === "local" ? "local" : "global";
      const colW = normalizedColwidth(config.colwidth);
      let rowIndex;
      if (numbering === "local") {
        rowIndex = localRowIndex;
      } else if (explicitRowMode && currentExplicitRow !== null) {
        rowIndex = currentExplicitRow;
        field.explicitRow = true;
      } else {
        rowIndex = Math.floor(field.start / colW);
        field.explicitRow = false;
      }
      field.visualRowIndex = rowIndex;

      if (pendingRowLabel && !currentSection.rowLabels.has(rowIndex)) {
        currentSection.rowLabels.set(rowIndex, pendingRowLabel);
      }
      const rowNote = appendNote(pendingRowNote, inlineLeftNote);
      if (rowNote) {
        currentSection.rowNotes.set(rowIndex, appendNote(currentSection.rowNotes.get(rowIndex) || "", rowNote));
      }
      pendingRowLabel = "";
      pendingRowNote = "";
      currentSection.fields.push(field);
      hasBody = true;
      continue;
    }

    throw new Error(`第 ${index + 1} 行无法解析: ${line}`);
  }

  finishSection();

  const nonEmptySections = sections.filter((section) => section.fields.length > 0);
  if (!hasBody && descTableEntries.length === 0) {
    return { config: sanitizeConfig(config, warnings), sections: [], fields: [], descTable: [], warnings };
  }

  const safeConfig = sanitizeConfig(config, warnings);
  if (ov.numbering) safeConfig.numbering = ov.numbering;
  if (ov.bit_order) safeConfig.bit_order = ov.bit_order;
  return {
    config: safeConfig,
    sections: nonEmptySections.map((section) => buildSectionRows(section, safeConfig)),
    fields: nonEmptySections.flatMap((section) => section.fields),
    descTable: buildDescTable(sections, descTableEntries),
    warnings
  };
}

function fieldBitRange(field) {
  return `${field.start}${field.start === field.end ? "" : `-${field.end}`}`;
}

function findFieldForDescKey(fields, key) {
  const keyLower = String(key).toLowerCase();
  return fields.find((field) => {
    const displayLabel = field.options.label || field.label;
    return field.label.toLowerCase() === keyLower || String(displayLabel).toLowerCase() === keyLower;
  });
}

function fieldRowNumber(field) {
  if (field && Number.isInteger(field.visualRowIndex)) {
    return field.visualRowIndex + 1;
  }
  return null;
}

function enrichDescEntry(entry, field) {
  if (!field) {
    return entry;
  }
  const enriched = { ...entry };
  if (!enriched.bitRange) {
    enriched.bitRange = fieldBitRange(field);
  }
  if (enriched.rowNumber === undefined || enriched.rowNumber === null) {
    enriched.rowNumber = fieldRowNumber(field);
  }
  return enriched;
}

function buildDescTable(sections, explicitEntries) {
  const allFields = sections.flatMap((section) => section.fields);
  const entries = explicitEntries.map((entry) => {
    const field = findFieldForDescKey(allFields, entry.label);
    return enrichDescEntry(entry, field);
  });
  const seenLabels = new Set(entries.map((e) => e.label.toLowerCase()));

  for (const section of sections) {
    for (const field of section.fields) {
      const displayLabel = field.options.label || field.label;
      const desc = field.options.description;
      const bitRange = fieldBitRange(field);
      const rowNumber = fieldRowNumber(field);
      const keys = new Set([field.label.toLowerCase(), String(displayLabel).toLowerCase()]);

      const existing = entries.find((e) => keys.has(e.label.toLowerCase()));
      if (existing) {
        if (!existing.bitRange) {
          existing.bitRange = bitRange;
        }
        if (existing.rowNumber === undefined || existing.rowNumber === null) {
          existing.rowNumber = rowNumber;
        }
        if (desc && !existing.description) {
          existing.description = String(desc);
        }
        continue;
      }

      if (desc && !seenLabels.has(String(displayLabel).toLowerCase())) {
        entries.push({
          label: displayLabel,
          description: String(desc),
          bitRange,
          rowNumber
        });
        seenLabels.add(String(displayLabel).toLowerCase());
      }
    }
  }

  return entries;
}

function createSection(name) {
  return {
    name,
    fields: [],
    rowLabels: new Map(),
    rowNotes: new Map()
  };
}

function extractPacketSource(source) {
  const fence = source.match(/```(?:packetdiag)?\s*([\s\S]*?)```/i);
  let text = fence ? fence[1].trim() : source.trim();
  text = text.replace(/^@startpacketdiag[^\n]*\n?/im, "").replace(/^@endpacketdiag[^\n]*/im, "").trim();
  return text;
}

function readLineComment(line) {
  const index = findCommentIndex(line);
  if (index < 0) return "";
  const skip = line[index] === "#" ? 1 : 2;
  return line.slice(index + skip).trim();
}

function stripLineComment(line) {
  const index = findCommentIndex(line);
  return index >= 0 ? line.slice(0, index) : line;
}

function findCommentIndex(line) {
  let quote = "";
  let slashIndex = -1;
  let hashIndex = -1;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quote) {
      if (char === "\\" && i + 1 < line.length) {
        i += 1;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "/" && i + 1 < line.length && line[i + 1] === "/" && slashIndex < 0) {
      slashIndex = i;
    }
    if (char === "#" && hashIndex < 0) {
      hashIndex = i;
    }
  }
  if (slashIndex >= 0 && hashIndex >= 0) return Math.min(slashIndex, hashIndex);
  return slashIndex >= 0 ? slashIndex : hashIndex;
}

function parseSectionComment(comment) {
  const match = comment.match(/^-{2,}\s*(.+?)\s*-{2,}$/);
  if (!match) {
    return "";
  }
  return match[1].trim();
}

function isUsefulRowLabel(comment) {
  return /^(变体|variant|alternative)\b/i.test(comment.trim());
}

function parseLeftNote(comment) {
  const match = comment.match(/^@left\s*:\s*(.+)$/i);
  return match ? match[1].trim() : "";
}

function parseAtRow(comment) {
  const match = comment.match(/^@row\s*:?\s*(.*)$/i);
  if (!match) return null;
  return match[1].trim();
}

function appendNote(current, next) {
  const cleanNext = String(next || "").trim();
  if (!cleanNext) {
    return current || "";
  }
  return current ? `${current}\n${cleanNext}` : cleanNext;
}

function parseValue(rawValue) {
  const clean = rawValue.trim().replace(/;$/, "").trim();
  const unquoted = unwrapQuotes(clean);
  if (/^-?\d+(?:\.\d+)?$/.test(unquoted)) {
    return Number(unquoted);
  }
  return unquoted;
}

function parseFieldLine(line, lineNumber) {
  const match = line.match(/^(\d+)(?:\s*-\s*(\d+))?\s*:\s*(.+?)\s*;?$/);
  if (!match) {
    return null;
  }

  const start = Number(match[1]);
  const end = match[2] === undefined ? start : Number(match[2]);
  if (end < start) {
    throw new Error(`第 ${lineNumber} 行 bit 范围结束值小于开始值`);
  }

  const labelAndOptions = splitLabelAndOptions(match[3].replace(/;$/, "").trim());
  if (!labelAndOptions.label) {
    throw new Error(`第 ${lineNumber} 行缺少字段名称`);
  }

  return {
    id: `${lineNumber}:${start}-${end}`,
    start,
    end,
    label: unwrapQuotes(labelAndOptions.label),
    options: labelAndOptions.options,
    lineNumber,
    sourceLine: line
  };
}

function splitLabelAndOptions(input) {
  let text = input.trim();
  const options = {};

  if (text.endsWith("]")) {
    const start = findTrailingOptionStart(text);
    if (start >= 0) {
      const rawOptions = text.slice(start + 1, -1).trim();
      if (/[A-Za-z_]\w*\s*=/.test(rawOptions)) {
        Object.assign(options, parseOptions(rawOptions));
        text = text.slice(0, start).trim();
      }
    }
  }

  return { label: text, options };
}

function findTrailingOptionStart(text) {
  let quote = "";
  let depth = 0;
  for (let i = text.length - 1; i >= 0; i -= 1) {
    const char = text[i];
    if (quote) {
      if (char === quote && text[i - 1] !== "\\") {
        quote = "";
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "]") {
      depth += 1;
      continue;
    }
    if (char === "[") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function parseOptions(rawOptions) {
  const options = {};
  const regex = /([A-Za-z_]\w*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\]\s]+))/g;
  let match;
  while ((match = regex.exec(rawOptions)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    options[key] = /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : value;
  }
  return options;
}

function unwrapQuotes(value) {
  const clean = String(value).trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    return clean.slice(1, -1);
  }
  return clean;
}

function sanitizeConfig(config, warnings = []) {
  let bitOrder = normalizeBitOrder(config.bit_order, warnings);

  if (config.scale_direction !== undefined) {
    const sd = String(config.scale_direction).trim().toLowerCase();
    if (sd === "right_to_left") {
      bitOrder = "desc";
    } else if (sd === "left_to_right") {
      bitOrder = "asc";
    } else {
      warnings.push(`scale_direction = "${config.scale_direction}" 无效，已忽略`);
    }
  }

  return {
    colwidth: normalizedColwidth(config.colwidth),
    node_height: clampNumber(config.node_height, 28, 180, 72),
    default_fontsize: clampNumber(config.default_fontsize, 8, 28, 12),
    bit_order: bitOrder,
    numbering: normalizeNumbering(config.numbering, warnings),
    scale_interval: Math.max(1, Math.min(64, parseInt(config.scale_interval, 10) || 8))
  };
}

function normalizeNumbering(value, warnings = []) {
  if (value === undefined || value === null || value === "") {
    return "global";
  }
  const mode = String(value).trim().toLowerCase();
  if (mode === "global" || mode === "local") {
    return mode;
  }
  warnings.push(`numbering = "${value}" 无效，已按 global 渲染`);
  return "global";
}

function normalizeBitOrder(value, warnings = []) {
  if (value === undefined || value === null || value === "") {
    return "asc";
  }
  const bitOrder = String(value).trim().toLowerCase();
  if (bitOrder === "asc" || bitOrder === "desc") {
    return bitOrder;
  }
  warnings.push(`bit_order = "${value}" 无效，已按 asc 渲染`);
  return "asc";
}

function buildSectionRows(section, config) {
  const colwidth = config.colwidth;
  const rowsByIndex = new Map();
  const fragmentsByField = new Map();

  const numbering = config.numbering === "local" ? "local" : "global";

  for (const field of section.fields) {
    let fragments;

    if (numbering === "local") {
      if (field.end >= colwidth) {
        throw new Error(
          `字段 "${field.label}" 的位范围 ${field.start}-${field.end} 超出 colwidth (${colwidth})。` +
          `在 numbering="local" 模式下，每行位号必须 < colwidth。`
        );
      }
      const rowIndex = field.visualRowIndex;
      const fragment = {
        field,
        rowIndex,
        start: field.start,
        end: field.end,
        colStart: field.start,
        colEnd: field.end,
        drawLabel: false
      };
      fragments = [fragment];

      if (!rowsByIndex.has(rowIndex)) {
        rowsByIndex.set(rowIndex, {
          index: rowIndex,
          label: section.rowLabels.get(rowIndex) || "",
          note: section.rowNotes.get(rowIndex) || "",
          fragments: []
        });
      }
      rowsByIndex.get(rowIndex).fragments.push(fragment);
    } else if (field.explicitRow) {
      const rowIdx = field.visualRowIndex;
      const rowStartBit = Math.floor(field.start / colwidth) * colwidth;
      const fragment = {
        field,
        rowIndex: rowIdx,
        start: field.start,
        end: field.end,
        colStart: field.start - rowStartBit,
        colEnd: field.end - rowStartBit,
        drawLabel: false
      };
      fragments = [fragment];

      if (!rowsByIndex.has(rowIdx)) {
        rowsByIndex.set(rowIdx, {
          index: rowIdx,
          label: section.rowLabels.get(rowIdx) || "",
          note: section.rowNotes.get(rowIdx) || "",
          fragments: []
        });
      }
      rowsByIndex.get(rowIdx).fragments.push(fragment);
    } else {
      const firstRow = Math.floor(field.start / colwidth);
      const lastRow = Math.floor(field.end / colwidth);
      fragments = [];

      for (let rowIdx = firstRow; rowIdx <= lastRow; rowIdx += 1) {
        const rowStartBit = rowIdx * colwidth;
        const fragmentStart = Math.max(field.start, rowStartBit);
        const fragmentEnd = Math.min(field.end, rowStartBit + colwidth - 1);
        const fragment = {
          field,
          rowIndex: rowIdx,
          start: fragmentStart,
          end: fragmentEnd,
          colStart: fragmentStart - rowStartBit,
          colEnd: fragmentEnd - rowStartBit,
          drawLabel: false
        };
        fragments.push(fragment);

        if (!rowsByIndex.has(rowIdx)) {
          rowsByIndex.set(rowIdx, {
            index: rowIdx,
            label: section.rowLabels.get(rowIdx) || "",
            note: section.rowNotes.get(rowIdx) || "",
            fragments: []
          });
        }
        rowsByIndex.get(rowIdx).fragments.push(fragment);
      }
    }

    fragmentsByField.set(field.id, fragments);
  }

  for (const fragments of fragmentsByField.values()) {
    let labelFragment = fragments[0];
    for (const fragment of fragments) {
      if (fragment.end - fragment.start > labelFragment.end - labelFragment.start) {
        labelFragment = fragment;
      }
    }
    labelFragment.drawLabel = true;
  }

  const rows = [...rowsByIndex.values()].sort((a, b) => a.index - b.index);
  for (const row of rows) {
    row.fragments.sort((a, b) => a.start - b.start || a.end - b.end);
  }

  return {
    name: section.name,
    rows
  };
}