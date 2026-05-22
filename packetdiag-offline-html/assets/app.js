"use strict";

const DEFAULT_PACKET_SOURCE = `packetdiag {
  colwidth = 32;
  node_height = 40;
  default_fontsize = 12;

  // ---- 基础头部 (Base Header: Word 0 ~ Word 7) ----

  // Word 0
  0-31: HOST_MAC;

  // Word 1
  32-47: HOST_MAC;
  48-63: NP_MAC;

  // Word 2
  64-95: NP_MAC;

  // Word 3
  96-111: "0x8100";
  112-127: VLAN;

  // Word 4
  128-143: "Ethernet Type";
  144-151: "Message Length";
  152-153: R;
  154: NS_E;
  155-159: R;

  // Word 5
  160-167: "Message Type";
  168-175: DISP_REG;
  176-179: DST_CHAIN_ID [textcolor = "red"];
  180-191: VRF [textcolor = "red"];

  // Word 6
  192-202: L2_IIF [textcolor = "red"];
  203: R;
  204-215: L2_EIF [textcolor = "red"];
  216-223: "TimeStamp[37:30]";

  // Word 7
  224: R;
  225-255: "TimeStamp[29:0]";

  // ---- 复用变体部分 (Alternatives for Word 8) ----
  
  // 变体 1: BFD上送
  256-287: "BFD Discriminator" [color = "#fce5cd"];

  // 变体 2: MOD上送
  288-311: R [color = "#fce5cd"];
  312-319: DISCARD_COUNTER_IDX [color = "#fce5cd"];

  // 变体 3: MAC地址学习
  320: VP_V [color = "#fce5cd"];
  321: R [color = "#fce5cd"];
  322-327: VP [color = "#fce5cd"];
  328-337: R [color = "#fce5cd"];
  338-351: VFI [color = "#fce5cd"];
}`;

const PRESETS = {
  packet: DEFAULT_PACKET_SOURCE,
  tcp: `packetdiag {
  colwidth = 32;
  node_height = 72;
  default_fontsize = 12;

  // ---- TCP Header ----
  0-15: Source Port [color = "#dbeafe"];
  16-31: Destination Port [color = "#dbeafe"];
  32-63: Sequence Number [color = "#fef3c7"];
  64-95: Acknowledgment Number [color = "#fef3c7"];
  96-99: Data Offset [color = "#dcfce7"];
  100-105: Reserved [color = "#e5e7eb"];
  106: URG [rotate = 270, color = "#fce7f3"];
  107: ACK [rotate = 270, color = "#fce7f3"];
  108: PSH [rotate = 270, color = "#fce7f3"];
  109: RST [rotate = 270, color = "#fce7f3"];
  110: SYN [rotate = 270, color = "#fce7f3"];
  111: FIN [rotate = 270, color = "#fce7f3"];
  112-127: Window [color = "#dbeafe"];
  128-143: Checksum [color = "#fee2e2"];
  144-159: Urgent Pointer [color = "#fee2e2"];
  160-191: "Options and Padding" [color = "#ede9fe"];
  192-223: data [colheight = 3, color = "#ccfbf1"];
}`,
  ipv4: `packetdiag {
  colwidth = 32;
  node_height = 54;
  default_fontsize = 13;

  // ---- IPv4 Header ----
  0-3: Version [color = "#dbeafe"];
  4-7: IHL [color = "#dbeafe"];
  8-13: DSCP [color = "#dcfce7"];
  14-15: ECN [color = "#dcfce7"];
  16-31: Total Length [color = "#fef3c7"];
  32-47: Identification [color = "#ede9fe"];
  48-50: Flags [color = "#fef9c3"];
  51-63: Fragment Offset [color = "#fef9c3"];
  64-71: TTL [color = "#fee2e2"];
  72-79: Protocol [color = "#fee2e2"];
  80-95: Header Checksum [color = "#e5e7eb"];
  96-127: Source Address [color = "#e0f2fe"];
  128-159: Destination Address [color = "#e0f2fe"];
}`,
  udp: `packetdiag {
  colwidth = 32;
  node_height = 60;
  default_fontsize = 13;

  // ---- UDP Header ----
  0-15: Source Port [color = "#dbeafe"];
  16-31: Destination Port [color = "#dbeafe"];
  32-47: Length [color = "#fef3c7"];
  48-63: Checksum [color = "#fee2e2"];
}`,
  ethernet: `packetdiag {
  colwidth = 32;
  node_height = 52;
  default_fontsize = 12;

  // ---- Ethernet Frame ----
  0-7: Preamble [color = "#e5e7eb"];
  8-15: SFD [color = "#d1d5db"];
  16-63: Destination MAC [color = "#dbeafe"];
  64-111: Source MAC [color = "#dbeafe"];
  112-127: EtherType [color = "#dcfce7"];
  128-159: Payload [color = "#fef3c7"];
  160-191: FCS [color = "#fee2e2"];
}`
};

const dom = {
  editor: document.getElementById("editor"),
  canvas: document.getElementById("diagramCanvas"),
  errorMessage: document.getElementById("errorMessage"),
  statusInfo: document.getElementById("statusInfo"),
  presetSelect: document.getElementById("presetSelect"),
  previewWrap: document.getElementById("previewWrap"),
  fitWidth: document.getElementById("fitWidth"),
  bitOrderMode: document.getElementById("bitOrderMode"),
  globalNote: document.getElementById("globalNote"),
  helpButton: document.getElementById("helpButton"),
  helpModal: document.getElementById("helpModal"),
  helpCloseButton: document.getElementById("helpCloseButton"),
  exportButton: document.getElementById("exportButton"),
  editorFontSize: document.getElementById("editorFontSize"),
  leftPanel: document.getElementById("leftPanel"),
  mainContainer: document.getElementById("mainContainer"),
  resizer: document.getElementById("resizer")
};

let currentSource = "";
let updateTimer = 0;
let lastParsed = null;
let activeCanvasEditor = null;

function parsePacketDiag(source) {
  const text = extractPacketSource(source);
  const lines = text.split(/\r?\n/);
  const config = {
    colwidth: 32,
    node_height: 72,
    default_fontsize: 12,
    bit_order: "asc"
  };
  const sections = [];
  const warnings = [];
  let currentSection = createSection("");
  let pendingRowLabel = "";
  let pendingRowNote = "";
  let hasBody = false;

  function finishSection() {
    if (currentSection.fields.length > 0 || currentSection.name) {
      sections.push(currentSection);
    }
    currentSection = createSection("");
  }

  for (let index = 0; index < lines.length; index += 1) {
    const originalLine = lines[index];
    const comment = readLineComment(originalLine);
    let line = stripLineComment(originalLine).trim();
    let inlineLeftNote = "";

    if (line === "packetdiag {" || line === "packetdiag{") {
      hasBody = true;
      continue;
    }

    if (line === "}") {
      continue;
    }

    if (comment) {
      const leftNote = parseLeftNote(comment);
      const sectionName = leftNote ? "" : parseSectionComment(comment);
      if (leftNote && line === "") {
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
      const rowIndex = Math.floor(field.start / normalizedColwidth(config.colwidth));
      if (pendingRowLabel && !currentSection.rowLabels.has(rowIndex)) {
        currentSection.rowLabels.set(rowIndex, pendingRowLabel);
      }
      if (pendingRowNote) {
        currentSection.rowNotes.set(rowIndex, appendNote(currentSection.rowNotes.get(rowIndex) || "", pendingRowNote));
      }
      pendingRowLabel = "";
      pendingRowNote = "";
      currentSection.fields.push(field);
      if (inlineLeftNote) {
        pendingRowNote = appendNote(pendingRowNote, inlineLeftNote);
      }
      hasBody = true;
      continue;
    }

    throw new Error(`第 ${index + 1} 行无法解析: ${line}`);
  }

  finishSection();

  const nonEmptySections = sections.filter((section) => section.fields.length > 0);
  if (!hasBody || nonEmptySections.length === 0) {
    return { config: sanitizeConfig(config, warnings), sections: [], fields: [], warnings };
  }

  const safeConfig = sanitizeConfig(config, warnings);
  return {
    config: safeConfig,
    sections: nonEmptySections.map((section) => buildSectionRows(section, safeConfig)),
    fields: nonEmptySections.flatMap((section) => section.fields),
    warnings
  };
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
  return fence ? fence[1].trim() : source.trim();
}

function readLineComment(line) {
  const index = findCommentIndex(line);
  return index >= 0 ? line.slice(index + 2).trim() : "";
}

function stripLineComment(line) {
  const index = findCommentIndex(line);
  return index >= 0 ? line.slice(0, index) : line;
}

function findCommentIndex(line) {
  let quote = "";
  for (let i = 0; i < line.length - 1; i += 1) {
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
    if (char === "/" && line[i + 1] === "/") {
      return i;
    }
  }
  return -1;
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
  return {
    colwidth: normalizedColwidth(config.colwidth),
    node_height: clampNumber(config.node_height, 28, 180, 72),
    default_fontsize: clampNumber(config.default_fontsize, 8, 28, 12),
    bit_order: normalizeBitOrder(config.bit_order, warnings)
  };
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

function normalizedColwidth(value) {
  return clampNumber(value, 1, 256, 32);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(number)));
}

function buildSectionRows(section, config) {
  const colwidth = config.colwidth;
  const rowsByIndex = new Map();
  const fragmentsByField = new Map();

  for (const field of section.fields) {
    const firstRow = Math.floor(field.start / colwidth);
    const lastRow = Math.floor(field.end / colwidth);
    const fragments = [];

    for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex += 1) {
      const rowStartBit = rowIndex * colwidth;
      const fragmentStart = Math.max(field.start, rowStartBit);
      const fragmentEnd = Math.min(field.end, rowStartBit + colwidth - 1);
      const fragment = {
        field,
        rowIndex,
        start: fragmentStart,
        end: fragmentEnd,
        colStart: fragmentStart - rowStartBit,
        colEnd: fragmentEnd - rowStartBit,
        drawLabel: false
      };
      fragments.push(fragment);

      if (!rowsByIndex.has(rowIndex)) {
        rowsByIndex.set(rowIndex, {
          index: rowIndex,
          label: section.rowLabels.get(rowIndex) || "",
          note: section.rowNotes.get(rowIndex) || "",
          fragments: []
        });
      }
      rowsByIndex.get(rowIndex).fragments.push(fragment);
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

function renderDiagram(parsed, canvas, options = {}) {
  const ctx = canvas.getContext("2d");
  const config = parsed.config;
  const pixelRatio = options.pixelRatio || window.devicePixelRatio || 1;
  const fitWidth = options.fitWidth ?? true;
  const requestedWidth = options.width || 980;
  const bitOrder = options.bitOrder === "desc" ? "desc" : "asc";
  const globalNote = String(options.globalNote || "").trim();
  const colwidth = config.colwidth;
  const nodeHeight = config.node_height;
  const fontSize = config.default_fontsize;
  const leftPad = 32;
  const rightPad = 32;
  const topPad = 28;
  const bottomPad = 28;
  const noteWidth = 220;
  const rowLabelWidth = 92;
  const leftGutter = noteWidth + rowLabelWidth;
  const minBitWidth = 12;
  const maxCanvasWidth = fitWidth ? requestedWidth : Math.max(requestedWidth, 1040);
  const diagramWidth = Math.max(colwidth * minBitWidth, maxCanvasWidth - leftPad - rightPad - leftGutter);
  const canvasWidth = Math.ceil(leftPad + leftGutter + diagramWidth + rightPad);
  const sectionGap = 28;
  const rulerHeight = 30;
  const rowGap = 12;
  const sectionTitleHeight = 28;
  const rowCaptionHeight = 18;
  const bitWidth = diagramWidth / colwidth;
  const noteLineHeight = 15;

  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  const globalNoteLines = wrapTextLines(ctx, globalNote, noteWidth - 12, 10);
  const globalNoteHeight = globalNoteLines.length > 0 ? 22 + globalNoteLines.length * noteLineHeight : 0;
  const sectionLayouts = parsed.sections.map((section) => ({
    section,
    rows: section.rows.map((row) => {
      const noteLines = wrapTextLines(ctx, row.note || "", noteWidth - 12, 8);
      return {
        row,
        noteLines,
        height: Math.max(rowHeight(row, nodeHeight), noteLines.length * noteLineHeight + 10)
      };
    })
  }));

  let canvasHeight = topPad + bottomPad + globalNoteHeight + (globalNoteHeight > 0 ? 18 : 0);
  for (const layout of sectionLayouts) {
    if (layout.section.name) {
      canvasHeight += sectionTitleHeight;
    }
    canvasHeight += rulerHeight;
    for (const rowLayout of layout.rows) {
      canvasHeight += rowCaptionHeight + rowLayout.height + rowGap;
    }
    canvasHeight += sectionGap;
  }
  canvasHeight = Math.max(260, Math.ceil(canvasHeight));

  canvas.width = Math.ceil(canvasWidth * pixelRatio);
  canvas.height = Math.ceil(canvasHeight * pixelRatio);
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const hitBoxes = [];
  let y = topPad;

  if (globalNoteLines.length > 0) {
    drawNoteBlock(ctx, "全局注释", globalNoteLines, leftPad, y, noteWidth, globalNoteHeight);
    y += globalNoteHeight + 18;
  }

  if (parsed.sections.length === 0) {
    drawEmptyState(ctx, canvasWidth, canvasHeight, y);
    canvas._hitBoxes = [];
    return { width: canvasWidth, height: canvasHeight, hitBoxes };
  }

  for (const layout of sectionLayouts) {
    const section = layout.section;
    const noteX = leftPad;
    const labelX = leftPad + noteWidth;
    const gridX = leftPad + leftGutter;

    if (section.name) {
      drawSectionTitle(ctx, section.name, leftPad, y, canvasWidth - leftPad - rightPad, sectionTitleHeight, fontSize);
      y += sectionTitleHeight;
    }

    drawRuler(ctx, gridX, y, diagramWidth, colwidth, bitWidth, bitOrder);
    y += rulerHeight;

    for (const rowLayout of layout.rows) {
      const row = rowLayout.row;
      const caption = row.label || `${row.index * colwidth}-${row.index * colwidth + colwidth - 1}`;
      const actualRowHeight = rowLayout.height;
      drawRowCaption(ctx, caption, labelX, y + rowCaptionHeight, rowLabelWidth - 12);
      y += rowCaptionHeight;

      drawRowNote(ctx, rowLayout.noteLines, noteX, y, noteWidth, actualRowHeight);
      drawRowGrid(ctx, gridX, y, diagramWidth, actualRowHeight, colwidth, bitWidth);

      for (const fragment of row.fragments) {
        const field = fragment.field;
        const x = fragmentX(gridX, fragment, colwidth, bitWidth, bitOrder);
        const w = Math.max(1.5, (fragment.colEnd - fragment.colStart + 1) * bitWidth);
        const h = Math.min(actualRowHeight, nodeHeight * normalizedColheight(field.options.colheight));
        const color = field.options.color || defaultColorFor(field.label);
        drawCell(ctx, fragment, x, y, w, h, color, fontSize);
        hitBoxes.push({ x, y, w, h, fragment });
      }

      y += actualRowHeight + rowGap;
    }

    y += sectionGap;
  }

  canvas._hitBoxes = hitBoxes;
  return { width: canvasWidth, height: canvasHeight, hitBoxes };
}

function fragmentX(gridX, fragment, colwidth, bitWidth, bitOrder) {
  if (bitOrder === "desc") {
    return gridX + (colwidth - 1 - fragment.colEnd) * bitWidth;
  }
  return gridX + fragment.colStart * bitWidth;
}

function rowHeight(row, nodeHeight) {
  return Math.max(...row.fragments.map((fragment) => nodeHeight * normalizedColheight(fragment.field.options.colheight)), nodeHeight);
}

function normalizedColheight(value) {
  return clampNumber(value, 1, 12, 1);
}

function drawEmptyState(ctx, width, height, top = 0) {
  ctx.fillStyle = "#f8faf9";
  ctx.fillRect(0, top, width, height - top);
  ctx.fillStyle = "#65726a";
  ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("输入 PacketDiag 源码后会在这里显示图片", width / 2, top + (height - top) / 2);
  ctx.textAlign = "start";
}

function drawSectionTitle(ctx, text, x, y, width, height, fontSize) {
  ctx.fillStyle = "#202321";
  roundRect(ctx, x, y, width, height, 5);
  ctx.fill();
  ctx.fillStyle = "#f4fbf7";
  ctx.font = `700 ${Math.max(12, fontSize + 1)}px "Segoe UI", system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 12, y + height / 2);
}

function drawRuler(ctx, x, y, width, colwidth, bitWidth, bitOrder) {
  ctx.strokeStyle = "#9aa49d";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 22.5);
  ctx.lineTo(x + width, y + 22.5);
  ctx.stroke();

  ctx.fillStyle = "#49524b";
  ctx.font = '11px "Cascadia Mono", Consolas, monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const marks = buildRulerMarks(colwidth);
  drawRulerTick(ctx, x, y, "start");
  drawRulerTick(ctx, x + width, y, "start");
  for (const mark of marks) {
    if (mark >= colwidth) {
      continue;
    }
    const markX = bitOrder === "desc" ? x + (colwidth - 1 - mark) * bitWidth : x + mark * bitWidth;
    drawRulerTick(ctx, markX, y, mark % 8 === 0 || mark === colwidth - 1 ? "major" : "minor");
    if (mark % 8 === 0 || mark === colwidth - 1) {
      ctx.fillText(String(mark), markX, y + 10);
    }
  }

  ctx.textAlign = "start";
}

function drawRulerTick(ctx, x, y, kind) {
  const isMajor = kind !== "minor";
  ctx.strokeStyle = isMajor ? "#6b746d" : "#c8cec9";
  ctx.beginPath();
  ctx.moveTo(x + 0.5, y + (isMajor ? 4 : 12));
  ctx.lineTo(x + 0.5, y + 23);
  ctx.stroke();
}

function buildRulerMarks(colwidth) {
  const marks = new Set([0, colwidth]);
  for (let bit = 8; bit < colwidth; bit += 8) {
    marks.add(bit);
  }
  marks.add(colwidth - 1);
  return [...marks].sort((a, b) => a - b);
}

function drawRowCaption(ctx, text, x, y, maxWidth) {
  ctx.fillStyle = "#5e6961";
  ctx.font = '12px "Cascadia Mono", Consolas, monospace';
  ctx.textBaseline = "alphabetic";
  ctx.fillText(fitText(ctx, text, maxWidth), x, y - 4);
}

function drawNoteBlock(ctx, title, lines, x, y, width, height) {
  ctx.fillStyle = "#f6faf7";
  roundRect(ctx, x, y, width, height, 6);
  ctx.fill();
  ctx.strokeStyle = "#d8e1dc";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#304138";
  ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, x + 10, y + 15);
  drawWrappedLines(ctx, lines, x + 10, y + 35, 15, "#51645a");
}

function drawRowNote(ctx, lines, x, y, width, height) {
  if (lines.length === 0) {
    return;
  }
  ctx.fillStyle = "#f8fbf9";
  roundRect(ctx, x, y, width - 12, height, 5);
  ctx.fill();
  ctx.strokeStyle = "#dbe3de";
  ctx.lineWidth = 1;
  ctx.stroke();
  drawWrappedLines(ctx, lines, x + 9, y + 16, 15, "#4d5e55");
}

function drawWrappedLines(ctx, lines, x, y, lineHeight, color) {
  ctx.fillStyle = color;
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = "alphabetic";
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], x, y + i * lineHeight);
  }
}

function drawRowGrid(ctx, x, y, width, height, colwidth, bitWidth) {
  ctx.fillStyle = "#fbfcfb";
  ctx.strokeStyle = "#d9dfdb";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width, height);

  ctx.strokeStyle = "#edf0ed";
  ctx.beginPath();
  for (let bit = 1; bit < colwidth; bit += 1) {
    const lineX = x + bit * bitWidth;
    ctx.moveTo(lineX + 0.5, y);
    ctx.lineTo(lineX + 0.5, y + height);
  }
  ctx.stroke();

  ctx.strokeStyle = "#c7cec8";
  ctx.beginPath();
  for (let bit = 8; bit < colwidth; bit += 8) {
    const lineX = x + bit * bitWidth;
    ctx.moveTo(lineX + 0.5, y);
    ctx.lineTo(lineX + 0.5, y + height);
  }
  ctx.stroke();
}

function drawCell(ctx, fragment, x, y, w, h, color, fontSize) {
  const field = fragment.field;
  ctx.fillStyle = color;
  roundRect(ctx, x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), 4);
  ctx.fill();

  ctx.strokeStyle = "#30343a";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = field.options.textcolor || "#111827";
  ctx.font = `600 ${Math.max(8, Math.min(fontSize, h * 0.36))}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const bitText = `${fragment.start}${fragment.start === fragment.end ? "" : `-${fragment.end}`}`;
  ctx.save();
  ctx.fillStyle = "rgba(17, 24, 39, 0.56)";
  ctx.font = '10px "Cascadia Mono", Consolas, monospace';
  ctx.textAlign = "left";
  if (w > 30 && h > 26) {
    ctx.fillText(bitText, x + 5, y + 13);
  }
  ctx.restore();

  if (!fragment.drawLabel || w < 7 || h < 18) {
    ctx.textAlign = "start";
    return;
  }

  const rotate = Number(field.options.rotate);
  const shouldRotate = rotate === 90 || rotate === 270 || (w < 30 && h > 38);
  if (shouldRotate) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rotate === 90 ? Math.PI / 2 : -Math.PI / 2);
    ctx.fillText(fitText(ctx, field.label, Math.max(10, h - 12)), 0, 0);
    ctx.restore();
  } else {
    ctx.fillText(fitText(ctx, field.label, Math.max(6, w - 12)), x + w / 2, y + h / 2 + 3);
  }
  ctx.textAlign = "start";
}

function roundRect(ctx, x, y, width, height, radius) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth) {
  const value = String(text);
  if (ctx.measureText(value).width <= maxWidth) {
    return value;
  }
  if (maxWidth < ctx.measureText("...").width + 4) {
    return "";
  }
  let fitted = value;
  while (fitted.length > 1 && ctx.measureText(`${fitted}...`).width > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  return `${fitted}...`;
}

function wrapTextLines(ctx, text, maxWidth, maxLines) {
  const source = String(text || "").trim();
  if (!source) {
    return [];
  }

  const lines = [];
  const paragraphs = source.split(/\r?\n/);
  for (const paragraph of paragraphs) {
    let line = "";
    const tokens = splitWrapTokens(paragraph);
    for (const token of tokens) {
      const cleanToken = line ? token : token.trimStart();
      if (ctx.measureText(cleanToken).width > maxWidth) {
        if (line) {
          lines.push(line.trimEnd());
          line = "";
          if (lines.length >= maxLines) {
            return truncateWrappedLines(ctx, lines, maxWidth);
          }
        }
        const pieces = splitLongToken(ctx, cleanToken, maxWidth);
        for (let i = 0; i < pieces.length - 1; i += 1) {
          lines.push(pieces[i]);
          if (lines.length >= maxLines) {
            return truncateWrappedLines(ctx, lines, maxWidth);
          }
        }
        line = pieces[pieces.length - 1] || "";
        continue;
      }

      const candidate = line ? `${line}${token}` : cleanToken;
      if (ctx.measureText(candidate).width <= maxWidth || line === "") {
        line = candidate;
      } else {
        lines.push(line.trimEnd());
        line = token.trimStart();
      }

      if (lines.length >= maxLines) {
        return truncateWrappedLines(ctx, lines, maxWidth);
      }
    }
    if (line) {
      lines.push(line.trimEnd());
    }
    if (lines.length >= maxLines) {
      return truncateWrappedLines(ctx, lines, maxWidth);
    }
  }
  return lines;
}

function splitLongToken(ctx, token, maxWidth) {
  const pieces = [];
  let line = "";
  for (const char of token) {
    const candidate = `${line}${char}`;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      pieces.push(line);
      line = char;
    } else {
      line = candidate;
    }
  }
  if (line) {
    pieces.push(line);
  }
  return pieces.length > 0 ? pieces : [token];
}

function splitWrapTokens(text) {
  const tokens = [];
  let buffer = "";
  for (const char of String(text)) {
    buffer += char;
    if (/\s/.test(char) || /[\u4e00-\u9fff]/.test(char)) {
      tokens.push(buffer);
      buffer = "";
    }
  }
  if (buffer) {
    tokens.push(buffer);
  }
  return tokens;
}

function truncateWrappedLines(ctx, lines, maxWidth) {
  const result = lines.slice(0);
  const lastIndex = result.length - 1;
  if (lastIndex >= 0) {
    result[lastIndex] = fitText(ctx, `${result[lastIndex]}...`, maxWidth);
  }
  return result;
}

function defaultColorFor(label) {
  const palette = [
    "#dbeafe",
    "#dcfce7",
    "#fef3c7",
    "#fee2e2",
    "#ede9fe",
    "#e0f2fe",
    "#fce7f3",
    "#e5e7eb",
    "#ccfbf1",
    "#ffedd5"
  ];
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

function update() {
  currentSource = dom.editor.value;
  try {
    const parsed = parsePacketDiag(currentSource);
    lastParsed = parsed;
    const availableWidth = Math.max(560, dom.previewWrap.clientWidth - 48);
    const bitOrder = getEffectiveBitOrder(parsed);
    const layout = renderDiagram(parsed, dom.canvas, {
      width: dom.fitWidth.checked ? availableWidth : 1040,
      fitWidth: dom.fitWidth.checked,
      bitOrder,
      globalNote: dom.globalNote.value
    });
    const warningText = parsed.warnings.length > 0 ? `警告: ${parsed.warnings.join("；")}` : "";
    dom.errorMessage.value = warningText;
    dom.errorMessage.textContent = warningText;

    if (parsed.sections.length === 0) {
      dom.statusInfo.textContent = "等待输入";
      return;
    }

    const sectionCount = parsed.sections.length;
    const rowCount = parsed.sections.reduce((count, section) => count + section.rows.length, 0);
    const fieldCount = parsed.fields.length;
    dom.statusInfo.textContent = `${sectionCount} 个区段, ${rowCount} 行, ${fieldCount} 个字段, 位序 ${bitOrderLabel(bitOrder)}, ${layout.width}x${layout.height}`;
  } catch (error) {
    lastParsed = null;
    dom.errorMessage.value = `解析错误: ${error.message}`;
    dom.errorMessage.textContent = `解析错误: ${error.message}`;
    dom.statusInfo.textContent = "解析失败";
    renderDiagram({ config: sanitizeConfig({}), sections: [], fields: [] }, dom.canvas, {
      width: Math.max(560, dom.previewWrap.clientWidth - 48),
      bitOrder: "asc",
      globalNote: ""
    });
  }
}

function getEffectiveBitOrder(parsed) {
  const mode = dom.bitOrderMode.value;
  if (mode === "asc" || mode === "desc") {
    return mode;
  }
  return parsed?.config?.bit_order === "desc" ? "desc" : "asc";
}

function bitOrderLabel(bitOrder) {
  return bitOrder === "desc" ? "31 -> 0" : "0 -> 31";
}

function scheduleUpdate() {
  window.clearTimeout(updateTimer);
  updateTimer = window.setTimeout(update, 120);
}

function findCanvasHit(event) {
  const boxes = dom.canvas._hitBoxes || [];
  const rect = dom.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return boxes.find((box) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) || null;
}

function openCanvasLabelEditor(hit) {
  closeCanvasLabelEditor(false);

  const field = hit.fragment.field;
  const canvasRect = dom.canvas.getBoundingClientRect();
  const wrapRect = dom.previewWrap.getBoundingClientRect();
  const input = document.createElement("input");
  input.type = "text";
  input.className = "canvas-label-editor";
  input.value = field.label;
  input.setAttribute("aria-label", `编辑 ${field.start}-${field.end} 字段文字`);

  const width = Math.max(112, Math.min(320, hit.w + 28));
  const height = Math.max(30, Math.min(48, hit.h));
  input.style.left = `${canvasRect.left - wrapRect.left + hit.x + (hit.w - width) / 2}px`;
  input.style.top = `${canvasRect.top - wrapRect.top + hit.y + (hit.h - height) / 2}px`;
  input.style.width = `${width}px`;
  input.style.height = `${height}px`;

  activeCanvasEditor = {
    input,
    field: { ...field },
    originalSource: dom.editor.value,
    originalLabel: field.label,
    currentLabel: field.label,
    sourceLineIndex: null
  };

  input.addEventListener("input", () => {
    syncCanvasLabelEdit(input.value);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      closeCanvasLabelEditor(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelCanvasLabelEdit();
    }
  });
  input.addEventListener("blur", () => {
    closeCanvasLabelEditor(true);
  });

  dom.previewWrap.appendChild(input);
  input.focus();
  input.select();
}

function syncCanvasLabelEdit(nextLabel) {
  if (!activeCanvasEditor) {
    return;
  }

  const result = replaceFieldLabel(dom.editor.value, activeCanvasEditor, nextLabel);
  if (!result.changed) {
    dom.errorMessage.textContent = "无法定位源码字段，不能同步修改";
    dom.errorMessage.value = dom.errorMessage.textContent;
    return;
  }

  activeCanvasEditor.sourceLineIndex = result.lineIndex;
  activeCanvasEditor.currentLabel = nextLabel;
  dom.editor.value = result.source;
  update();
}

function closeCanvasLabelEditor(commit) {
  if (!activeCanvasEditor) {
    return;
  }
  const editor = activeCanvasEditor;
  activeCanvasEditor = null;
  editor.input.remove();
  if (commit) {
    update();
  }
}

function cancelCanvasLabelEdit() {
  if (!activeCanvasEditor) {
    return;
  }
  const originalSource = activeCanvasEditor.originalSource;
  closeCanvasLabelEditor(false);
  dom.editor.value = originalSource;
  update();
}

function replaceFieldLabel(source, editState, nextLabel) {
  const lines = source.split(/\r?\n/);
  const lineIndex = findFieldLineIndex(lines, editState);
  if (lineIndex < 0) {
    return { changed: false, source, lineIndex: -1 };
  }

  lines[lineIndex] = replaceLabelInLine(lines[lineIndex], nextLabel);
  return {
    changed: true,
    source: lines.join("\n"),
    lineIndex
  };
}

function findFieldLineIndex(lines, editState) {
  if (Number.isInteger(editState.sourceLineIndex) && matchesFieldLine(lines[editState.sourceLineIndex], editState.field)) {
    return editState.sourceLineIndex;
  }

  const preferred = editState.field.lineNumber - 1;
  if (matchesFieldLine(lines[preferred], editState.field)) {
    return preferred;
  }

  for (let i = 0; i < lines.length; i += 1) {
    if (matchesFieldLine(lines[i], editState.field, editState.currentLabel) || matchesFieldLine(lines[i], editState.field, editState.originalLabel)) {
      return i;
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    if (matchesFieldLine(lines[i], editState.field)) {
      return i;
    }
  }

  return -1;
}

function matchesFieldLine(line, field, expectedLabel = null) {
  if (typeof line !== "string") {
    return false;
  }
  try {
    const parsed = parseFieldLine(stripLineComment(line).trim(), 1);
    if (!parsed || parsed.start !== field.start || parsed.end !== field.end) {
      return false;
    }
    return expectedLabel === null || parsed.label === expectedLabel;
  } catch {
    return false;
  }
}

function replaceLabelInLine(line, nextLabel) {
  const commentIndex = findCommentIndex(line);
  const comment = commentIndex >= 0 ? line.slice(commentIndex) : "";
  const code = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
  const match = code.match(/^(\s*\d+(?:\s*-\s*\d+)?\s*:\s*)([\s\S]*?)(\s*)$/);
  if (!match) {
    return line;
  }

  const prefix = match[1];
  const trailingWhitespace = match[3] || "";
  let body = match[2].trimEnd();
  let semicolon = "";
  if (body.endsWith(";")) {
    semicolon = ";";
    body = body.slice(0, -1).trimEnd();
  }

  let options = "";
  if (body.endsWith("]")) {
    const optionStart = findTrailingOptionStart(body);
    if (optionStart >= 0) {
      const rawOptions = body.slice(optionStart + 1, -1).trim();
      if (/[A-Za-z_]\w*\s*=/.test(rawOptions)) {
        options = ` ${body.slice(optionStart).trim()}`;
      }
    }
  }

  const newCode = `${prefix}${formatLabelForSource(nextLabel)}${options}${semicolon}${trailingWhitespace}`;
  return comment ? `${newCode}${comment}` : newCode;
}

function formatLabelForSource(label) {
  const value = String(label);
  if (/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(value)) {
    return value;
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function exportPng() {
  if (!lastParsed) {
    return;
  }

  const exportCanvas = document.createElement("canvas");
  renderDiagram(lastParsed, exportCanvas, {
    width: 1280,
    fitWidth: false,
    pixelRatio: 2,
    bitOrder: getEffectiveBitOrder(lastParsed),
    globalNote: dom.globalNote.value
  });

  const link = document.createElement("a");
  link.download = "packetdiag.png";
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
}

function installEditorShortcuts() {
  dom.editor.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") {
      return;
    }
    event.preventDefault();
    const start = dom.editor.selectionStart;
    const end = dom.editor.selectionEnd;
    dom.editor.setRangeText("  ", start, end, "end");
    scheduleUpdate();
  });
}

function installResizer() {
  let isDragging = false;

  dom.resizer.addEventListener("pointerdown", (event) => {
    isDragging = true;
    dom.resizer.classList.add("is-active");
    dom.resizer.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  dom.resizer.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }
    const bounds = dom.mainContainer.getBoundingClientRect();
    const percent = ((event.clientX - bounds.left) / bounds.width) * 100;
    dom.leftPanel.style.width = `${Math.max(24, Math.min(72, percent))}%`;
    scheduleUpdate();
  });

  function stopDrag(event) {
    if (!isDragging) {
      return;
    }
    isDragging = false;
    dom.resizer.classList.remove("is-active");
    if (event.pointerId !== undefined && dom.resizer.hasPointerCapture(event.pointerId)) {
      dom.resizer.releasePointerCapture(event.pointerId);
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    update();
  }

  dom.resizer.addEventListener("pointerup", stopDrag);
  dom.resizer.addEventListener("pointercancel", stopDrag);
}

function installTooltip() {
  dom.canvas.addEventListener("mousemove", (event) => {
    const hit = findCanvasHit(event);
    if (!hit) {
      dom.canvas.title = "";
      return;
    }
    const field = hit.fragment.field;
    dom.canvas.title = `${field.start}-${field.end}: ${field.label}，双击可编辑`;
  });

  dom.canvas.addEventListener("dblclick", (event) => {
    const hit = findCanvasHit(event);
    if (!hit) {
      return;
    }
    event.preventDefault();
    openCanvasLabelEditor(hit);
  });
}

function init() {
  dom.editor.value = PRESETS.packet;
  dom.presetSelect.value = "packet";
  dom.bitOrderMode.value = "source";
  dom.editor.style.fontSize = `${dom.editorFontSize.value}px`;

  dom.presetSelect.addEventListener("change", () => {
    closeCanvasLabelEditor(false);
    const source = PRESETS[dom.presetSelect.value];
    if (source) {
      dom.editor.value = source;
      update();
    }
  });

  dom.editor.addEventListener("input", () => {
    closeCanvasLabelEditor(false);
    scheduleUpdate();
  });
  dom.fitWidth.addEventListener("change", update);
  dom.bitOrderMode.addEventListener("change", update);
  dom.globalNote.addEventListener("input", scheduleUpdate);
  dom.helpButton.addEventListener("click", openHelp);
  dom.helpCloseButton.addEventListener("click", closeHelp);
  dom.helpModal.addEventListener("click", (event) => {
    if (event.target === dom.helpModal) {
      closeHelp();
    }
  });
  dom.exportButton.addEventListener("click", exportPng);
  dom.editorFontSize.addEventListener("input", () => {
    dom.editor.style.fontSize = `${dom.editorFontSize.value}px`;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dom.helpModal.hidden) {
      closeHelp();
    }
  });
  window.addEventListener("resize", scheduleUpdate);

  installEditorShortcuts();
  installResizer();
  installTooltip();
  update();
}

function openHelp() {
  dom.helpModal.hidden = false;
  dom.helpCloseButton.focus();
}

function closeHelp() {
  dom.helpModal.hidden = true;
  dom.helpButton.focus();
}

init();
