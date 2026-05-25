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
  const rowLabelWidth = 120;
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

  const descTableBlockHeight = measureDescTableHeight(parsed.descTable);
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
  if (descTableBlockHeight > 0) {
    canvasHeight += descTableBlockHeight;
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

  if (parsed.sections.length === 0 && (!parsed.descTable || parsed.descTable.length === 0)) {
    drawEmptyState(ctx, canvasWidth, canvasHeight, y);
    canvas._hitBoxes = [];
    return { width: canvasWidth, height: canvasHeight, hitBoxes };
  }

  if (parsed.sections.length === 0 && parsed.descTable && parsed.descTable.length > 0) {
    y = drawDescTable(ctx, parsed.descTable, leftPad, y + 16, canvasWidth - leftPad - rightPad, fontSize);
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

    drawRuler(ctx, gridX, y, diagramWidth, colwidth, bitWidth, bitOrder, config.scale_interval);
    y += rulerHeight;

    for (const rowLayout of layout.rows) {
      const row = rowLayout.row;
      const rowBitStart = row.fragments.length > 0
        ? Math.min(...row.fragments.map((fragment) => fragment.start))
        : row.index * colwidth;
      const rowBitEnd = row.fragments.length > 0
        ? Math.max(...row.fragments.map((fragment) => fragment.end))
        : row.index * colwidth + colwidth - 1;
      const bitRange = config.numbering === "local" ? `0-${colwidth - 1}` : `${rowBitStart}-${rowBitEnd}`;
      const caption = row.label || `Row ${row.index + 1}  ${bitRange}`;
      const actualRowHeight = rowLayout.height;
      drawRowCaption(ctx, caption, labelX, y + rowCaptionHeight, rowLabelWidth - 12);
      y += rowCaptionHeight;

      drawRowNote(ctx, rowLayout.noteLines, noteX, y, noteWidth, actualRowHeight);
      drawRowGrid(ctx, gridX, y, diagramWidth, actualRowHeight, colwidth, bitWidth, config.scale_interval);

      for (const fragment of row.fragments) {
        const field = fragment.field;
        const x = fragmentX(gridX, fragment, colwidth, bitWidth, bitOrder);
        const w = Math.max(1.5, (fragment.colEnd - fragment.colStart + 1) * bitWidth);
        const h = Math.min(actualRowHeight, nodeHeight * normalizedColheight(field.options.colheight));
        const color = field.options.color || defaultColorFor(field.label);
        drawCell(ctx, fragment, x, y, w, h, color, fontSize);
        hitBoxes.push({ x, y, w, h, fragment });
      }

      // Sparse packet: draw indicator for uncovered bit ranges
      drawSparseGaps(ctx, row, gridX, y, actualRowHeight, colwidth, bitWidth, bitOrder);

      y += actualRowHeight + rowGap;
    }

    y += sectionGap;
  }

  // Description table
  if (parsed.descTable && parsed.descTable.length > 0) {
    y += 12;
    y = drawDescTable(ctx, parsed.descTable, leftPad, y, canvasWidth - leftPad - rightPad, fontSize);
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

function drawRuler(ctx, x, y, width, colwidth, bitWidth, bitOrder, scaleInterval) {
  const interval = scaleInterval || 8;
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

  const marks = buildRulerMarks(colwidth, interval);
  drawRulerTick(ctx, x, y, "start");
  drawRulerTick(ctx, x + width, y, "start");
  for (const mark of marks) {
    if (mark >= colwidth) {
      continue;
    }
    const markX = bitOrder === "desc" ? x + (colwidth - 1 - mark) * bitWidth : x + mark * bitWidth;
    const isMajor = mark % interval === 0 || mark === colwidth - 1;
    drawRulerTick(ctx, markX, y, isMajor ? "major" : "minor");
    if (isMajor) {
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

function buildRulerMarks(colwidth, scaleInterval) {
  const interval = scaleInterval || 8;
  const marks = new Set([0, colwidth]);
  for (let bit = interval; bit < colwidth; bit += interval) {
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

function drawRowGrid(ctx, x, y, width, height, colwidth, bitWidth, scaleInterval) {
  const interval = scaleInterval || 8;
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
  for (let bit = interval; bit < colwidth; bit += interval) {
    const lineX = x + bit * bitWidth;
    ctx.moveTo(lineX + 0.5, y);
    ctx.lineTo(lineX + 0.5, y + height);
  }
  ctx.stroke();
}

function drawSparseGaps(ctx, row, x, y, rowHeight, colwidth, bitWidth, bitOrder) {
  const fragments = [...row.fragments].sort((a, b) => a.colStart - b.colStart);
  const gaps = [];
  let cursor = 0;

  for (const frag of fragments) {
    if (frag.colStart > cursor) {
      gaps.push({ start: cursor, end: frag.colStart - 1 });
    }
    cursor = Math.max(cursor, frag.colEnd + 1);
  }
  if (cursor < colwidth) {
    gaps.push({ start: cursor, end: colwidth - 1 });
  }

  if (gaps.length === 0 || (gaps.length === 1 && gaps[0].start === 0 && gaps[0].end === colwidth - 1)) {
    return;
  }

  for (const gap of gaps) {
    const gapX = bitOrder === "desc"
      ? x + (colwidth - 1 - gap.end) * bitWidth
      : x + gap.start * bitWidth;
    const gapW = Math.max(2, (gap.end - gap.start + 1) * bitWidth);
    ctx.save();
    ctx.fillStyle = "rgba(120, 130, 124, 0.08)";
    ctx.fillRect(gapX, y + 1, gapW, rowHeight - 1);
    if (gapW > 20) {
      ctx.fillStyle = "rgba(120, 130, 124, 0.18)";
      ctx.font = 'italic 10px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("···", gapX + gapW / 2, y + rowHeight / 2);
    }
    ctx.restore();
  }
}

function measureDescTableHeight(entries) {
  if (!entries || entries.length === 0) {
    return 0;
  }
  const titleHeight = 28;
  const rowHeight = 26;
  const headerHeight = 26;
  return 12 + titleHeight + 6 + headerHeight + 2 + entries.length * (rowHeight + 1) + 4;
}

function drawDescTable(ctx, entries, x, y, maxWidth, fontSize) {
  const titleHeight = 28;
  const rowHeight = 26;
  const headerHeight = 26;
  const pad = 12;
  const colNoW = Math.min(52, maxWidth * 0.08);
  const colNameW = Math.min(160, maxWidth * 0.24);
  const colBitW = Math.min(100, maxWidth * 0.16);
  const colDescW = maxWidth - colNoW - colNameW - colBitW;
  const colWidths = [colNoW, colNameW, colBitW, colDescW];

  // Title bar
  ctx.fillStyle = "#374151";
  roundRect(ctx, x + 0.5, y + 0.5, maxWidth, titleHeight, 5);
  ctx.fill();
  ctx.fillStyle = "#f4fbf7";
  ctx.font = `700 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText("\u{1F4CB} 描述表 (Description Table)", x + pad, y + titleHeight / 2);

  y += titleHeight + 6;

  // Header
  drawDescRow(ctx, x, y, colWidths, rowHeight, "#d1d5db", "#1f2937", true,
    ["行号", "字段名称", "位范围", "描述"]);
  y += headerHeight + 2;

  // Data rows
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const bgColor = i % 2 === 0 ? "#f9fafb" : "#f3f4f6";
    drawDescRow(ctx, x, y, colWidths, rowHeight, bgColor, "#374151", false, [
      entry.rowNumber ?? "-",
      String(entry.label),
      entry.bitRange || "-",
      String(entry.description)
    ]);
    y += rowHeight + 1;
  }

  return y + 4;
}

function drawDescRow(ctx, x, y, widths, h, bgColor, textColor, isHeader, cells) {
  const totalW = widths.reduce((sum, width) => sum + width, 0);
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, totalW, h);

  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, totalW, h);

  ctx.fillStyle = textColor;
  ctx.textBaseline = "middle";
  const font = isHeader
    ? `700 11px "Segoe UI", system-ui, sans-serif`
    : `11px "Segoe UI", system-ui, sans-serif`;

  let columnX = x;
  for (let i = 0; i < cells.length; i += 1) {
    const columnWidth = widths[i];
    const useMono = i === 0 || i === 2;
    ctx.font = useMono ? `11px "Cascadia Mono", Consolas, monospace` : font;
    ctx.textAlign = i === 0 ? "center" : "left";

    ctx.save();
    ctx.beginPath();
    ctx.rect(columnX, y, columnWidth, h);
    ctx.clip();
    const textX = i === 0 ? columnX + columnWidth / 2 : columnX + 8;
    ctx.fillText(fitText(ctx, String(cells[i]), columnWidth - 10), textX, y + h / 2 + 1);
    ctx.restore();

    columnX += columnWidth;
  }
  ctx.textAlign = "start";

  // Column dividers
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  columnX = x;
  for (let i = 0; i < widths.length - 1; i += 1) {
    columnX += widths[i];
    ctx.moveTo(columnX + 0.5, y);
    ctx.lineTo(columnX + 0.5, y + h);
  }
  ctx.stroke();
}

function getDisplayLabel(field) {
  return field.options.label || field.label;
}

function drawCell(ctx, fragment, x, y, w, h, color, fontSize) {
  const field = fragment.field;
  const displayLabel = getDisplayLabel(field);
  const borderStyle = field.options.style || "solid";
  const showNumber = field.options.number !== undefined ? !!field.options.number : true;
  const shape = field.options.shape || "box";
  const varLen = field.options.len !== undefined ? Number(field.options.len) || 0 : 0;
  const hasIcon = field.options.icon !== undefined;
  const bgValue = field.options.background;

  // background attribute overrides color when it's a CSS color value
  let cellColor = color;
  if (bgValue !== undefined) {
    const bg = String(bgValue);
    if (/^#[0-9a-fA-F]{3,8}$/.test(bg) || /^(rgb|hsl|var|currentColor|[a-z]+)/i.test(bg)) {
      cellColor = bg;
    }
  }

  ctx.fillStyle = cellColor;
  if (shape === "ellipse") {
    ellipsePath(ctx, x + w / 2, y + h / 2, Math.max(0, w / 2 - 1), Math.max(0, h / 2 - 1));
    ctx.fill();
    if (borderStyle !== "none") {
      ctx.strokeStyle = "#30343a";
      ctx.lineWidth = 1;
      if (borderStyle === "dashed") {
        ctx.setLineDash([4, 3]);
      } else if (borderStyle === "dotted") {
        ctx.setLineDash([2, 3]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else {
    roundRect(ctx, x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1), 4);
    ctx.fill();
  }

  // Variable-length indicator: zigzag right edge
  if (varLen > 0 && shape !== "ellipse" && w > 8) {
    ctx.save();
    ctx.fillStyle = cellColor;
    ctx.beginPath();
    const zigX = x + w - 5;
    ctx.moveTo(zigX, y + 0.5);
    for (let zi = 0; zi < Math.floor(h / 4); zi += 1) {
      const zy = y + zi * 4;
      ctx.lineTo(zi % 2 === 0 ? zigX + 5 : zigX, zy + 2);
    }
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + 0.5);
    ctx.closePath();
    ctx.fill();
    // redraw main border
    if (borderStyle !== "none") {
      ctx.strokeStyle = "#30343a";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // len label
    if (w > 40 && h > 20) {
      ctx.fillStyle = "rgba(17, 24, 39, 0.45)";
      ctx.font = '9px "Cascadia Mono", Consolas, monospace';
      ctx.textAlign = "right";
      ctx.fillText(`len=${varLen}`, x + w - 5, y + h - 4);
    }
    ctx.restore();
  }

  if (borderStyle !== "none") {
    ctx.strokeStyle = "#30343a";
    ctx.lineWidth = 1;
    if (borderStyle === "dashed") {
      ctx.setLineDash([4, 3]);
    } else if (borderStyle === "dotted") {
      ctx.setLineDash([2, 3]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Icon badge
  if (hasIcon && w > 30 && h > 20) {
    ctx.save();
    ctx.fillStyle = "rgba(17, 24, 39, 0.62)";
    ctx.beginPath();
    ctx.arc(x + w - 10, y + 10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0f4f1";
    ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("i", x + w - 9.5, y + 10.5);
    ctx.restore();
  }

  ctx.fillStyle = field.options.textcolor || "#111827";
  ctx.font = `600 ${Math.max(8, Math.min(fontSize, h * 0.36))}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (showNumber) {
    const bitText = `${fragment.start}${fragment.start === fragment.end ? "" : `-${fragment.end}`}`;
    ctx.save();
    ctx.fillStyle = "rgba(17, 24, 39, 0.56)";
    ctx.font = '10px "Cascadia Mono", Consolas, monospace';
    ctx.textAlign = "left";
    if (w > 30 && h > 26) {
      ctx.fillText(bitText, x + 5, y + 13);
    }
    ctx.restore();
  }

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
    ctx.fillText(fitText(ctx, displayLabel, Math.max(10, h - 12)), 0, 0);
    ctx.restore();
  } else {
    ctx.fillText(fitText(ctx, displayLabel, Math.max(6, w - 12)), x + w / 2, y + h / 2 + 3);
  }
  ctx.textAlign = "start";
}

function ellipsePath(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
  ctx.closePath();
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