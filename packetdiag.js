/* ══════════════════════════════════════════════════
   PacketDiag Viewer — JavaScript
   ══════════════════════════════════════════════════ */

// ──────────────────────────────────────
// 0. Utilities
// ──────────────────────────────────────
function $(sel, ctx)   { return (ctx||document).querySelector(sel); }
function $$(sel, ctx)  { return Array.from((ctx||document).querySelectorAll(sel)); }
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ──────────────────────────────────────
// 1. Preset Definitions
// ──────────────────────────────────────
const PRESETS = {
  custom: `packetdiag {
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
}`,

  ipv4: `packetdiag {
  colwidth = 32;
  node_height = 48;
  default_fontsize = 12;

  // ---- IPv4 Header (20 bytes / 160 bits) ----

  0-3:   Version         [color = "#a8d8ea"];
  4-7:   IHL             [color = "#a8d8ea"];
  8-13:  DSCP            [color = "#b5e8c3"];
  14-15: ECN             [color = "#b5e8c3"];
  16-31: Total Length    [color = "#f5d6a8"];

  32-47: Identification  [color = "#d5c4e8"];
  48-50: Flags           [color = "#f5f0b0"];
  51-63: Fragment Offset [color = "#f5f0b0"];

  64-71: TTL             [color = "#f5b0b0"];
  72-79: Protocol        [color = "#f5b0b0"];
  80-95: Header Checksum [color = "#d8d8d8"];

  96-127:  Source Address       [color = "#a0c8f0"];

  128-159: Destination Address  [color = "#a0c8f0"];

  160-191: Options (if IHL > 5) [color = "#e0dcc8"];
  192-255: Padding              [color = "#e8e8e8"];
}`,

  tcp: `packetdiag {
  colwidth = 32;
  node_height = 46;
  default_fontsize = 12;

  // ---- TCP Header ----

  0-15:   Source Port           [color = "#a8d8ea"];
  16-31:  Destination Port      [color = "#a8d8ea"];

  32-63:  Sequence Number       [color = "#f5d6a8"];

  64-95:  Acknowledgment Number [color = "#f5d6a8"];

  96-99:  Data Offset  [color = "#b5e8c3"];
  100-102: Reserved    [color = "#e8e8e8"];
  103:   NS   [color = "#f5f0b0"];
  104:   CWR  [color = "#f5f0b0"];
  105:   ECE  [color = "#f5f0b0"];
  106:   URG  [color = "#f5b0b0"];
  107:   ACK  [color = "#f5b0b0"];
  108:   PSH  [color = "#f5b0b0"];
  109:   RST  [color = "#f5b0b0"];
  110:   SYN  [color = "#f5b0b0"];
  111:   FIN  [color = "#f5b0b0"];
  112-127: Window Size          [color = "#a8d8ea"];

  128-143: Checksum             [color = "#d5c4e8"];
  144-159: Urgent Pointer       [color = "#d5c4e8"];

  160-255: Options + Padding    [color = "#e0dcc8"];
}`,

  udp: `packetdiag {
  colwidth = 32;
  node_height = 56;
  default_fontsize = 13;

  // ---- UDP Datagram ----

  0-15:   Source Port       [color = "#a8d8ea"];
  16-31:  Destination Port  [color = "#a8d8ea"];

  32-47:  Length            [color = "#f5d6a8"];
  48-63:  Checksum          [color = "#f5b0b0"];
}`,

  ethernet: `packetdiag {
  colwidth = 32;
  node_height = 44;
  default_fontsize = 12;

  // ---- Ethernet II Frame (IEEE 802.3) ----

  0-55:    Preamble + SFD        [color = "#e0e0e0"];
  56-103:  Destination MAC       [color = "#a8d8ea"];
  104-151: Source MAC            [color = "#a8d8ea"];
  152-167: EtherType / Length    [color = "#b5e8c3"];
  168-175: Payload (46-1500 B)   [color = "#f5d6a8"];
  176-207: FCS (CRC32)           [color = "#f5b0b0"];
}`,

  local_example: `packetdiag {
  colwidth = 32;
  node_height = 44;
  default_fontsize = 12;
  numbering = "local";

  // ---- TCP 逐行展示 (local numbering) ----

  // @row: Word 0 — Src/Dst Ports
  0-15: Source Port       [color = "#a8d8ea"];
  16-31: Dest Port        [color = "#a8d8ea"];

  // @row: Word 1 — Seq#
  0-31: Sequence Number   [color = "#f5d6a8"];

  // @row: Word 2 — Ack#
  0-31: Ack Number        [color = "#f5d6a8"];

  // @row: Word 3 — Flags + Window
  0-3:   Data Offset      [color = "#b5e8c3"];
  4-7:   Reserved         [color = "#e8e8e8"];
  8:     CWR              [color = "#f5f0b0"];
  9:     ECE              [color = "#f5f0b0"];
  10:    URG              [color = "#f5b0b0"];
  11:    ACK              [color = "#f5b0b0"];
  12:    PSH              [color = "#f5b0b0"];
  13:    RST              [color = "#f5b0b0"];
  14:    SYN              [color = "#f5b0b0"];
  15:    FIN              [color = "#f5b0b0"];
  16-31: Window Size      [color = "#a8d8ea"];

  // @row: Word 4 — Checksum + Urgent
  0-15: Checksum          [color = "#d5c4e8"];
  16-31: Urgent Pointer   [color = "#d5c4e8"];
}`,
};

// ──────────────────────────────────────
// 2. Parser
// ──────────────────────────────────────
/**
 * Parse packetdiag source.
 *
 * Returns: { config, sections[], hasData }
 *
 * Section:  { name, rows: Row[] }
 * Row:      { label, leftLabel, isAtRow, rowIndex, cells: Cell[] }
 * Cell:     { start, end, colStart, colEnd, label, color, textColor, sourceLine }
 *
 * config keys:
 *   colwidth, node_height, default_fontsize (numeric)
 *   numbering   — "global" (default) | "local"
 *   bit_order   — "asc" (default) | "desc"
 */
function parsePacketDiag(source, uiOverrides) {
  const ov = uiOverrides || {};
  const UNRECOGNIZED = {};

  const config = { numbering: 'global', bit_order: 'asc' };
  const sections = [];
  let currentSection = null;
  let currentRow = null;
  let pendingLeftLabel = null;   // @left text → next row
  let rowIndexCounter = 0;       // for local mode / @row
  let explicitRowRequested = false; // @row seen → start new row on next cell

  const lines = source.split(/\r?\n/);

  function pushRow() {
    if (!currentRow || currentRow.cells.length === 0) return;
    currentRow.cells.sort((a, b) => a.start - b.start);
    if (!currentSection) currentSection = { name: '', rows: [] };
    currentSection.rows.push(currentRow);
  }

  function newRow(label) {
    if (currentRow && currentRow.cells.length > 0) {
      currentRow.cells.sort((a, b) => a.start - b.start);
    }
    currentRow = {
      label: label || '',
      leftLabel: pendingLeftLabel || '',
      isAtRow: explicitRowRequested,
      rowIndex: rowIndexCounter++,
      cells: [],
    };
    pendingLeftLabel = null;
    explicitRowRequested = false;
  }

  function flushSection() {
    pushRow();
    if (currentSection && currentSection.rows.length > 0) {
      sections.push(currentSection);
    }
    currentSection = null;
    currentRow = null;
    rowIndexCounter = 0;
    pendingLeftLabel = null;
    explicitRowRequested = false;
  }

  // Ensure a row exists to receive data
  function ensureRow() {
    if (!currentSection) currentSection = { name: '', rows: [] };
    if (!currentRow) newRow('');
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    let line = raw;
    const lineNum = i;

    // ── Section header:  // ---- ... ----  or  // ---- ...  ──
    const secMatch = line.match(/^\s*\/\/\s*-{3,}\s*(.+?)\s*-{0,}\s*$/);
    if (secMatch) {
      flushSection();
      currentSection = { name: secMatch[1].trim(), rows: [] };
      rowIndexCounter = 0;
      newRow('');
      continue;
    }

    // ── Strip inline comment ──
    const commIdx = line.indexOf('//');
    let trailingComment = '';
    if (commIdx >= 0) {
      trailingComment = line.substring(commIdx + 2).trim();
      line = line.substring(0, commIdx).trim();
    }

    // ── Detect special comment directives ──
    // @row  or  @row: label
    const atRowMatch = trailingComment.match(/^@row\s*:?\s*(.*)$/i);
    // @left: text
    const atLeftMatch = trailingComment.match(/^@left\s*:?\s*(.+)$/i);
    // variant / alternative
    const isVariant = /^(变体|variant|alternative|alt)\s*[:：\d]/i.test(trailingComment);
    const isRowComment = trailingComment.length > 0 && !atRowMatch && !atLeftMatch;

    // ── @row directive ──
    if (atRowMatch) {
      pushRow();
      explicitRowRequested = true;
      const rowLabel = atRowMatch[1].trim();
      newRow(rowLabel);
      if (line !== '') {
        // @row on same line as content (unusual but handle gracefully)
      }
      continue;
    }

    // ── @left directive ──
    if (atLeftMatch) {
      pendingLeftLabel = atLeftMatch[1].trim();
      continue;
    }

    // ── Blank line ──
    if (line === '') {
      if (!explicitRowRequested) {
        // In global mode: blank lines create row boundaries
        // In local mode:  blank lines also create boundaries unless @row is the primary mechanism
        pushRow();
      }
      if (isVariant && currentSection) {
        pushRow();
        newRow(trailingComment);
        explicitRowRequested = false;
      } else if (isRowComment && (!currentRow || currentRow.cells.length === 0)) {
        if (currentRow) currentRow.label = trailingComment;
        else newRow(trailingComment);
      } else if (!currentRow || currentRow.cells.length > 0) {
        newRow('');
      }
      explicitRowRequested = false;
      continue;
    }

    // ── Ensure row ──
    ensureRow();

    // ── Variant marker before cells → split row ──
    if (isVariant && currentRow.cells.length > 0) {
      pushRow();
      newRow(trailingComment);
      explicitRowRequested = false;
    }

    // ── Non-directive comment on empty row → label ──
    if (isRowComment && currentRow.cells.length === 0 && !isVariant) {
      currentRow.label = trailingComment;
    }

    // ── Config: key = value; ──
    const cfgMatch = line.match(/^(\w+)\s*=\s*(.+?)\s*;?\s*$/);
    if (cfgMatch) {
      let val = cfgMatch[2].trim();
      val = val.replace(/^["']|["'];?$/g, '');
      config[cfgMatch[1]] = isNaN(Number(val)) ? val : Number(val);
      continue;
    }

    // ── Bit range: start[-end]: label [options] ──
    const bitMatch = line.match(/^(\d+)(?:\s*-\s*(\d+))?\s*:\s*(.+)\s*$/);
    if (bitMatch) {
      const start = parseInt(bitMatch[1]);
      const end   = bitMatch[2] !== undefined ? parseInt(bitMatch[2]) : start;
      let labelPart = bitMatch[3].trim().replace(/;\s*$/, '');

      // Extract options [...] at the end
      let color = null, textColor = null;
      const optIdx = labelPart.lastIndexOf('[');
      if (optIdx >= 0 && labelPart.endsWith(']')) {
        const optStr = labelPart.substring(optIdx + 1, labelPart.length - 1);
        labelPart = labelPart.substring(0, optIdx).trim();
        const optRe = /(\w+)\s*=\s*"([^"]*)"|(\w+)\s*=\s*'([^']*)'|(\w+)\s*=\s*([^\s,\]]+)/g;
        let m;
        while ((m = optRe.exec(optStr)) !== null) {
          const key = (m[1] || m[3] || m[5]).toLowerCase();
          const val = m[2] || m[4] || m[6];
          if (key === 'color') color = val;
          else if (key === 'textcolor') textColor = val;
        }
      }
      labelPart = labelPart.replace(/^["']|["']$/g, '');

      currentRow.cells.push({
        start, end,
        colStart: start,        // display columns; adjusted in post-process
        colEnd: end,
        label: labelPart,
        color,
        textColor,
        sourceLine: lineNum,
      });
      continue;
    }

    // ── Unrecognized non-empty line → row break ──
    if (line.length > 0 && currentRow.cells.length > 0 && line !== UNRECOGNIZED) {
      pushRow();
      newRow('');
    }
  }

  // ── Flush remaining ──
  pushRow();
  if (currentSection && currentSection.rows.length > 0) {
    sections.push(currentSection);
  }

  // ── Determine effective numbering & bit_order (UI overrides win) ──
  if (ov.numbering)   config._effectiveNumbering = ov.numbering;
  else                config._effectiveNumbering = config.numbering || 'global';
  if (ov.bit_order)   config._effectiveBitOrder = ov.bit_order;
  else                config._effectiveBitOrder = config.bit_order || 'asc';

  const isLocal  = config._effectiveNumbering === 'local';
  const isDesc   = config._effectiveBitOrder === 'desc';
  const colwidth = config.colwidth || 32;

  // ── Post-process: assign colStart / colEnd / rowIndex ──
  if (isLocal) {
    // Local mode: each row's bits are relative; validate against colwidth
    for (const sec of sections) {
      for (const row of sec.rows) {
        for (const cell of row.cells) {
          cell.colStart = cell.start;
          cell.colEnd   = cell.end;
          if (cell.end >= colwidth) {
            throw new Error(
              `字段 "${cell.label}" 的位范围 ${cell.start}-${cell.end} 超出 colwidth (${colwidth})。` +
              `在 numbering="local" 模式下，每行位号必须 < colwidth。`
            );
          }
        }
      }
    }
  } else {
    // Global mode: merge contiguous rows (unless separated by @row or variant)
    for (const sec of sections) {
      const merged = [];
      for (let i = 0; i < sec.rows.length; i++) {
        const row = sec.rows[i];
        if (merged.length === 0) { merged.push(row); continue; }
        const prev = merged[merged.length - 1];

        const prevMax = prev.cells.length > 0 ? Math.max(...prev.cells.map(c => c.end)) : -1;
        const rowMin  = row.cells.length  > 0 ? Math.min(...row.cells.map(c => c.start)) : Infinity;
        const isVar   = /变体|variant|alternative/i.test(row.label);
        const prevVar = /变体|variant|alternative/i.test(prev.label);

        // Don't merge if @row was explicitly used
        if (row.isAtRow || prev.isAtRow) {
          merged.push(row); continue;
        }
        if (!isVar && !prevVar && prevMax + 1 === rowMin && prevMax >= 0) {
          prev.cells.push(...row.cells);
          prev.cells.sort((a, b) => a.start - b.start);
          if (row.label && !prev.label) prev.label = row.label;
          if (row.leftLabel && !prev.leftLabel) prev.leftLabel = row.leftLabel;
        } else {
          merged.push(row);
        }
      }
      sec.rows = merged;
    }

    // Assign colStart / colEnd = raw start / end
    for (const sec of sections) {
      for (const row of sec.rows) {
        for (const cell of row.cells) {
          cell.colStart = cell.start;
          cell.colEnd   = cell.end;
        }
      }
    }
  }

  const hasData = sections.some(s => s.rows.some(r => r.cells.length > 0));
  return { config, sections, hasData };
}

// ──────────────────────────────────────
// 3. Color Palette
// ──────────────────────────────────────
const DEFAULT_COLORS = [
  '#3a3f5c', '#3d4258', '#404660', '#434b64',
  '#464f68', '#3b4055', '#3f445a', '#424860',
];

// ──────────────────────────────────────
// 4. Shared layout helpers
// ──────────────────────────────────────
function buildLayout(parsed, availW) {
  const cfg   = parsed.config;
  const isLocal = cfg._effectiveNumbering === 'local';
  const isDesc  = cfg._effectiveBitOrder === 'desc';
  const colwidth = cfg.colwidth || 32;

  const leftPad  = 50;
  const rightPad = 24;
  const drawW    = availW - leftPad - rightPad;
  const nodeH    = cfg.node_height || 40;
  const fontSize = cfg.default_fontsize || 12;
  const rulerH   = 32;
  const secHdrH  = 26;
  const secGap   = 22;
  const rowGap   = 14;
  const topPad   = 18;
  const bottomPad = 24;

  // ── Determine per-row bit width ──
  let totalBits;
  if (isLocal) {
    totalBits = colwidth;
  } else {
    let gMin = Infinity, gMax = -Infinity;
    for (const sec of parsed.sections)
      for (const row of sec.rows)
        for (const c of row.cells) {
          if (c.colStart < gMin) gMin = c.colStart;
          if (c.colEnd   > gMax) gMax = c.colEnd;
        }
    if (!isFinite(gMin)) { gMin = 0; gMax = colwidth - 1; }
    totalBits = gMax - gMin + 1;
  }

  // ── bit→x helpers ──
  function bitX(bit, rowTotalBits) {
    const tb = rowTotalBits || totalBits;
    if (isDesc) return leftPad + ((tb - 1 - bit) / tb) * drawW;
    return leftPad + (bit / tb) * drawW;
  }
  function bitW(count, rowTotalBits) {
    const tb = rowTotalBits || totalBits;
    return (count / tb) * drawW;
  }
  // Cell left edge: in desc mode the higher bit is drawn on the left
  function cellLeft(cell, rowTotalBits) {
    if (isDesc) return bitX(cell.colEnd, rowTotalBits);
    return bitX(cell.colStart, rowTotalBits);
  }

  // ── Calculate total height ──
  let totalH = topPad + rulerH + 10;
  for (const sec of parsed.sections) {
    totalH += secHdrH + 6;
    for (let ri = 0; ri < sec.rows.length; ri++) {
      const row = sec.rows[ri];
      const showLabel = !!(row.label && /变体|variant|alternative/i.test(row.label));
      const showRowLabel = !!(row.label && row.isAtRow && !/变体|variant/i.test(row.label));
      if (showLabel || showRowLabel) totalH += 18;
      if (row.leftLabel) totalH += 16;
      totalH += 16 + nodeH + 6;
      if (ri < sec.rows.length - 1) totalH += rowGap;
    }
    totalH += secGap;
  }
  totalH += bottomPad;

  // ── Build cell-rect list for hit-test ──
  const cellRects = [];
  let y = topPad + rulerH + 10;

  for (const sec of parsed.sections) {
    if (sec.name) y += secHdrH + 6;

    for (let ri = 0; ri < sec.rows.length; ri++) {
      const row = sec.rows[ri];
      if (row.cells.length === 0) { y += (ri < sec.rows.length - 1 ? rowGap : 0); continue; }

      const showLabel = !!(row.label && /变体|variant|alternative/i.test(row.label));
      const showRowLabel = !!(row.label && row.isAtRow && !/变体|variant/i.test(row.label));
      if (showLabel || showRowLabel) y += 18;
      if (row.leftLabel) y += 16;

      const rowTotalBits = isLocal ? colwidth : totalBits;
      const rowMin = isLocal ? 0 : Math.min(...row.cells.map(c => c.colStart));

      // Bit labels row
      y += 16;

      // Cell row — compute hit rects
      for (const cell of row.cells) {
        const cx = cellLeft(cell, rowTotalBits);
        const cw = Math.max(3, bitW(cell.colEnd - cell.colStart + 1, rowTotalBits));
        cellRects.push({ x: cx + 1, y, w: cw - 2, h: nodeH, cell, row });
      }
      y += nodeH + 6;
      if (ri < sec.rows.length - 1) y += rowGap;
    }
    y += secGap;
  }

  return {
    leftPad, rightPad, drawW, nodeH, fontSize, rulerH, secHdrH, secGap, rowGap, topPad, bottomPad,
    totalBits, isLocal, isDesc, colwidth,
    bitX, bitW, cellLeft, totalH, cellRects,
  };
}

// ──────────────────────────────────────
// 5. Canvas Renderer
// ──────────────────────────────────────
function renderToCanvas(parsed, canvas, options) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const availW = options.width || 960;

  const L = buildLayout(parsed, availW);
  const totalH = Math.max(200, L.totalH);

  // Setup canvas
  canvas.width  = availW * dpr;
  canvas.height = totalH * dpr;
  canvas.style.width  = availW + 'px';
  canvas.style.height = totalH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Clear
  ctx.fillStyle = '#1a1b26';
  ctx.fillRect(0, 0, availW, totalH);

  let colorIdx = 0;
  function getColor(cell) {
    if (cell.color) return cell.color;
    return DEFAULT_COLORS[colorIdx++ % DEFAULT_COLORS.length];
  }

  let y = L.topPad;

  // ── Ruler ──
  drawRuler(ctx, L, y);
  y += L.rulerH + 10;

  // ── Sections ──
  for (const sec of parsed.sections) {
    if (sec.name) {
      ctx.fillStyle = '#2d3058';
      ctx.beginPath();
      roundRect(ctx, L.leftPad, y, L.drawW, L.secHdrH, 4);
      ctx.fill();
      ctx.fillStyle = '#c9d1d9';
      const hfs = Math.min(L.fontSize, 13);
      ctx.font = `600 ${hfs}px "Segoe UI",system-ui,sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'start';
      ctx.fillText(sec.name, L.leftPad + 12, y + L.secHdrH / 2);
      y += L.secHdrH + 6;
    }

    for (let ri = 0; ri < sec.rows.length; ri++) {
      const row = sec.rows[ri];
      if (row.cells.length === 0) continue;

      const rowTotalBits = L.isLocal ? L.colwidth : L.totalBits;

      // Row label (variant OR @row label)
      const showVariant = !!(row.label && /变体|variant|alternative/i.test(row.label));
      const showRowLabel = !!(row.label && row.isAtRow && !/变体|variant/i.test(row.label));
      if (showVariant) {
        ctx.fillStyle = '#d29922';
        ctx.font = `${L.fontSize - 1}px "Segoe UI",system-ui,sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'start';
        ctx.fillText('▸ ' + row.label, L.leftPad, y + L.fontSize + 2);
        y += 18;
      } else if (showRowLabel) {
        ctx.fillStyle = '#58a6ff';
        ctx.font = `600 ${L.fontSize - 1}px "Segoe UI",system-ui,sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'start';
        ctx.fillText('▸ ' + row.label, L.leftPad, y + L.fontSize + 2);
        y += 18;
      }

      // @left annotation
      if (row.leftLabel) {
        ctx.fillStyle = '#8b949e';
        ctx.font = `italic ${L.fontSize - 1}px "Segoe UI",system-ui,sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'start';
        ctx.fillText(row.leftLabel, L.leftPad, y + L.fontSize);
        y += 16;
      }

      // Bit range labels above cells
      ctx.fillStyle = '#6e7681';
      ctx.font = `600 ${Math.max(9, L.fontSize - 2)}px "Cascadia Code","Consolas",monospace`;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';

      for (const cell of row.cells) {
        const cx = L.cellLeft(cell, rowTotalBits);
        const cw = Math.max(3, L.bitW(cell.colEnd - cell.colStart + 1, rowTotalBits));
        const mid = cx + cw / 2;
        const txt = cell.start === cell.end ? String(cell.start) : `${cell.start}–${cell.end}`;
        ctx.fillText(txt, mid, y + L.fontSize);
      }
      y += 16;

      // Cells
      for (const cell of row.cells) {
        const cx = L.cellLeft(cell, rowTotalBits);
        const cw = Math.max(3, L.bitW(cell.colEnd - cell.colStart + 1, rowTotalBits));

        // Background
        const bgColor = getColor(cell);
        ctx.fillStyle = bgColor;
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        roundRect(ctx, cx + 1, y, cw - 2, L.nodeH, 3);
        ctx.fill();
        ctx.stroke();

        // Top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.beginPath();
        roundRectTop(ctx, cx + 1, y, cw - 2, L.nodeH * 0.4, 3);
        ctx.fill();

        // Label
        if (cw > 16 && L.nodeH > 16) {
          const tc = cell.textColor || '#e6edf3';
          ctx.fillStyle = tc;
          const maxF = Math.min(L.fontSize, L.nodeH * 0.42, cw * 0.38);
          const cfs = Math.max(8, maxF);
          ctx.font = `500 ${cfs}px "Segoe UI",system-ui,sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';

          let dl = cell.label;
          const maxTW = cw - 8;
          if (ctx.measureText(dl).width > maxTW) {
            while (dl.length > 2 && ctx.measureText(dl + '…').width > maxTW) dl = dl.slice(0, -1);
            dl += '…';
          }
          ctx.fillText(dl, cx + cw / 2, y + L.nodeH / 2);
        }
      }
      y += L.nodeH + 6;
      if (ri < sec.rows.length - 1) y += L.rowGap;
    }
    y += L.secGap;
  }

  // Store hit-test data
  canvas._parsed  = parsed;
  canvas._layout  = L;
  canvas._cellRects = L.cellRects;
}

function drawRuler(ctx, L, y) {
  ctx.fillStyle = '#2a2b3d';
  ctx.beginPath();
  roundRect(ctx, L.leftPad, y, L.drawW, L.rulerH, { tl:4, tr:4, br:0, bl:0 });
  ctx.fill();

  ctx.fillStyle = '#8b949e';
  ctx.font = `10px "Cascadia Code","Consolas",monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';

  const tb = L.totalBits;
  const interval = tb <= 64 ? 8 : (tb <= 128 ? 16 : 32);

  for (let b = 0; b <= tb; b += interval) {
    const bx = L.bitX(Math.min(b, tb - 1), tb);
    const isMajor = (b % 32 === 0);
    const tickH = isMajor ? L.rulerH * 0.6 : L.rulerH * 0.35;
    ctx.strokeStyle = isMajor ? '#6e7681' : '#484d60';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, y + L.rulerH);
    ctx.lineTo(bx, y + L.rulerH - tickH);
    ctx.stroke();

    if (b % interval === 0) {
      ctx.fillText(String(b), bx, y + 4);
    }
  }
}

// ── Rounded rect helpers ──
function roundRect(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = { tl:r, tr:r, br:r, bl:r };
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
}
function roundRectTop(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = { tl:r, tr:r, br:r, bl:r };
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
}

// ──────────────────────────────────────
// 6. SVG Generator
// ──────────────────────────────────────
function generateSVG(parsed, options) {
  const availW = options.width || 960;
  const L = buildLayout(parsed, availW);
  const totalH = Math.max(200, L.totalH);

  let colorIdx = 0;
  function getColor(cell) {
    if (cell.color) return cell.color;
    return DEFAULT_COLORS[colorIdx++ % DEFAULT_COLORS.length];
  }

  let svg = '';
  svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${availW} ${totalH}" width="${availW}" height="${totalH}">\n`;
  svg += `<rect width="100%" height="100%" fill="#1a1b26"/>\n`;
  svg += `<style>
  .cell-rect { stroke:rgba(255,255,255,0.06); stroke-width:0.75; }
  .cell-label { font-family:"Segoe UI",system-ui,sans-serif; fill:#e6edf3; text-anchor:middle; }
  .bit-label { font-family:"Cascadia Code",Consolas,monospace; fill:#6e7681; text-anchor:middle; font-weight:600; }
  .sec-hdr { font-family:"Segoe UI",system-ui,sans-serif; fill:#c9d1d9; font-weight:600; }
  .row-label { font-family:"Segoe UI",system-ui,sans-serif; }
  .ruler-text { font-family:"Cascadia Code",Consolas,monospace; fill:#8b949e; text-anchor:middle; }
</style>\n`;

  let y = L.topPad;

  // Ruler
  svg += `<rect x="${L.leftPad}" y="${y}" width="${L.drawW}" height="${L.rulerH}" rx="4" fill="#2a2b3d"/>\n`;
  svg += `<rect x="${L.leftPad}" y="${y}" width="${L.drawW}" height="4" fill="#2a2b3d"/>\n`;
  const tb = L.totalBits;
  const interval = tb <= 64 ? 8 : (tb <= 128 ? 16 : 32);
  for (let b = 0; b <= tb; b += interval) {
    const bx = L.bitX(Math.min(b, tb - 1), tb);
    const isMajor = (b % 32 === 0);
    const tickH = isMajor ? L.rulerH * 0.6 : L.rulerH * 0.35;
    const stroke = isMajor ? '#6e7681' : '#484d60';
    svg += `<line x1="${bx}" y1="${y + L.rulerH}" x2="${bx}" y2="${y + L.rulerH - tickH}" stroke="${stroke}" stroke-width="1"/>\n`;
    if (b % interval === 0) {
      svg += `<text x="${bx}" y="${y + 13}" font-size="10" class="ruler-text">${b}</text>\n`;
    }
  }
  y += L.rulerH + 10;

  // Sections
  for (const sec of parsed.sections) {
    if (sec.name) {
      svg += `<rect x="${L.leftPad}" y="${y}" width="${L.drawW}" height="${L.secHdrH}" rx="4" fill="#2d3058"/>\n`;
      const hfs = Math.min(L.fontSize, 13);
      svg += `<text x="${L.leftPad + 12}" y="${y + L.secHdrH / 2}" font-size="${hfs}" class="sec-hdr" dominant-baseline="central">${escapeHtml(sec.name)}</text>\n`;
      y += L.secHdrH + 6;
    }

    for (let ri = 0; ri < sec.rows.length; ri++) {
      const row = sec.rows[ri];
      if (row.cells.length === 0) continue;

      const rowTotalBits = L.isLocal ? L.colwidth : L.totalBits;

      const showVariant = !!(row.label && /变体|variant|alternative/i.test(row.label));
      const showRowLabel = !!(row.label && row.isAtRow && !/变体|variant/i.test(row.label));
      if (showVariant) {
        svg += `<text x="${L.leftPad}" y="${y + L.fontSize + 2}" font-size="${L.fontSize - 1}" class="row-label" fill="#d29922">▸ ${escapeHtml(row.label)}</text>\n`;
        y += 18;
      } else if (showRowLabel) {
        svg += `<text x="${L.leftPad}" y="${y + L.fontSize + 2}" font-size="${L.fontSize - 1}" class="row-label" fill="#58a6ff">▸ ${escapeHtml(row.label)}</text>\n`;
        y += 18;
      }

      if (row.leftLabel) {
        svg += `<text x="${L.leftPad}" y="${y + L.fontSize}" font-size="${L.fontSize - 1}" class="row-label" fill="#8b949e" font-style="italic">${escapeHtml(row.leftLabel)}</text>\n`;
        y += 16;
      }

      // Bit labels
      for (const cell of row.cells) {
        const cx = L.cellLeft(cell, rowTotalBits);
        const cw = Math.max(3, L.bitW(cell.colEnd - cell.colStart + 1, rowTotalBits));
        const mid = cx + cw / 2;
        const txt = cell.start === cell.end ? String(cell.start) : `${cell.start}–${cell.end}`;
        svg += `<text x="${mid}" y="${y + L.fontSize}" font-size="${Math.max(9, L.fontSize - 2)}" class="bit-label">${txt}</text>\n`;
      }
      y += 16;

      // Cells
      for (const cell of row.cells) {
        const cx = L.cellLeft(cell, rowTotalBits);
        const cw = Math.max(3, L.bitW(cell.colEnd - cell.colStart + 1, rowTotalBits));
        const bgColor = getColor(cell);
        svg += `<rect x="${cx + 1}" y="${y}" width="${cw - 2}" height="${L.nodeH}" rx="3" fill="${bgColor}" class="cell-rect"/>\n`;
        svg += `<rect x="${cx + 1}" y="${y}" width="${cw - 2}" height="${L.nodeH * 0.4}" rx="3" fill="rgba(255,255,255,0.04)"/>\n`;

        if (cw > 16 && L.nodeH > 16) {
          const tc = cell.textColor || '#e6edf3';
          const maxF = Math.min(L.fontSize, L.nodeH * 0.42, cw * 0.38);
          const cfs = Math.max(8, maxF);
          svg += `<text x="${cx + cw / 2}" y="${y + L.nodeH / 2}" font-size="${cfs}" class="cell-label" fill="${tc}" dominant-baseline="central">${escapeHtml(cell.label)}</text>\n`;
        }
      }
      y += L.nodeH + 6;
      if (ri < sec.rows.length - 1) y += L.rowGap;
    }
    y += L.secGap;
  }

  svg += `</svg>`;
  return svg;
}

function generateHTMLExport(parsed, options) {
  const svg = generateSVG(parsed, options);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PacketDiag Diagram</title>
<style>
  body { margin:0; padding:24px; background:#1a1b26; display:flex; justify-content:center;
         align-items:flex-start; min-height:100vh; }
  .diagram { max-width:100%; height:auto; }
</style>
</head>
<body><div class="diagram">${svg}</div></body>
</html>`;
}

// ──────────────────────────────────────
// 7. UI Controller
// ──────────────────────────────────────
class PacketDiagViewer {
  constructor() {
    this.editor      = $('#editor');
    this.canvas      = $('#canvas');
    this.errorEl     = $('#errorMsg');
    this.statusEl    = $('#statusInfo');
    this.previewWrap = $('#previewWrap');
    this.presetSel   = $('#presetSelect');
    this.fontSizeR   = $('#fontSize');
    this.exportBtn   = $('#exportBtn');
    this.exportMenu  = $('#exportMenu');
    this.helpBtn     = $('#helpBtn');
    this.helpModal   = $('#helpModal');
    this.toastEl     = $('#toast');
    this.resizer     = $('#resizer');
    this.leftPanel   = $('#leftPanel');
    this.numberingSel = $('#numberingSel');
    this.bitOrderSel  = $('#bitOrderSel');

    this.currentSource = '';
    this.updateTimer   = null;
    this.isResizing    = false;

    this.init();
  }

  init() {
    this.editor.addEventListener('input', () => this.debouncedUpdate());
    this.editor.addEventListener('keydown', (e) => this.handleKeydown(e));

    this.presetSel.addEventListener('change', () => this.loadPreset());
    this.fontSizeR.addEventListener('input', () => {
      this.editor.style.fontSize = this.fontSizeR.value + 'px';
    });

    // Numbering / bit_order toolbar overrides
    if (this.numberingSel) this.numberingSel.addEventListener('change', () => this.update());
    if (this.bitOrderSel)  this.bitOrderSel.addEventListener('change', () => this.update());

    // Resizer
    this.resizer.addEventListener('mousedown', (e) => this.startResize(e));
    document.addEventListener('mousemove', (e) => this.doResize(e));
    document.addEventListener('mouseup',   () => this.endResize());
    window.addEventListener('resize', () => { if (this.currentSource) this.update(); });

    // Export dropdown
    this.exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.exportMenu.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!this.exportBtn.contains(e.target) && !this.exportMenu.contains(e.target))
        this.exportMenu.classList.remove('open');
    });
    $('#exportPNG').addEventListener('click',  () => { this.exportPNG();  this.exportMenu.classList.remove('open'); });
    $('#exportSVG').addEventListener('click',  () => { this.exportSVG();  this.exportMenu.classList.remove('open'); });
    $('#exportHTML').addEventListener('click', () => { this.exportHTML(); this.exportMenu.classList.remove('open'); });

    // Help modal
    this.helpBtn.addEventListener('click', () => this.helpModal.classList.add('open'));
    $('#modalClose').addEventListener('click', () => this.helpModal.classList.remove('open'));
    this.helpModal.addEventListener('click', (e) => {
      if (e.target === this.helpModal) this.helpModal.classList.remove('open');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.helpModal.classList.contains('open'))
        this.helpModal.classList.remove('open');
    });

    // Double-click editing on canvas
    this.canvas.addEventListener('dblclick', (e) => this.handleDblClick(e));

    // Tooltip
    this.canvas.addEventListener('mousemove', (e) => this.showTooltip(e));
    this.canvas.addEventListener('mouseleave', () => { this.canvas.title = ''; });

    // Load initial
    this.editor.value = PRESETS.custom;
    this.update();
  }

  // ── UI overrides ──
  getUIOverrides() {
    const ov = {};
    if (this.numberingSel && this.numberingSel.value) {
      ov.numbering = this.numberingSel.value;
    }
    if (this.bitOrderSel && this.bitOrderSel.value) {
      ov.bit_order = this.bitOrderSel.value;
    }
    return ov;
  }

  // ── Update ──
  update() {
    const source = this.editor.value;
    this.currentSource = source;

    try {
      const overrides = this.getUIOverrides();
      const parsed = parsePacketDiag(source, overrides);

      if (!parsed.hasData) {
        this.errorEl.textContent = '';
        this.statusEl.textContent = '等待有效输入...';
        this.clearCanvas();
        return;
      }

      const wrapW = this.previewWrap.clientWidth - 48;
      const renderW = Math.max(560, Math.min(1200, wrapW));

      renderToCanvas(parsed, this.canvas, { width: renderW });

      const totalCells = parsed.sections.reduce((s, sec) =>
        s + sec.rows.reduce((rs, row) => rs + row.cells.length, 0), 0);
      const totalRows = parsed.sections.reduce((s, sec) => s + sec.rows.length, 0);
      const mode = parsed.config._effectiveNumbering === 'local' ? '每行独立' : '连续编号';
      const order = parsed.config._effectiveBitOrder === 'desc' ? '逆序' : '升序';
      this.errorEl.textContent = '';
      this.statusEl.textContent =
        `${parsed.sections.length} 区段 · ${totalRows} 行 · ${totalCells} 字段 · ${mode} · ${order}`;
    } catch (e) {
      this.errorEl.textContent = '解析错误: ' + e.message;
      this.statusEl.textContent = '解析失败';
      console.error(e);
    }
  }

  debouncedUpdate() {
    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => this.update(), 180);
  }

  clearCanvas() {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    c.width = 960 * dpr;  c.height = 120 * dpr;
    c.style.width = '960px'; c.style.height = '120px';
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1a1b26';
    ctx.fillRect(0, 0, 960, 120);
  }

  handleKeydown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = this.editor.selectionStart;
      const end = this.editor.selectionEnd;
      this.editor.value = this.editor.value.substring(0, s) + '  ' + this.editor.value.substring(end);
      this.editor.selectionStart = this.editor.selectionEnd = s + 2;
      this.debouncedUpdate();
    }
  }

  // ── Presets ──
  loadPreset() {
    const key = this.presetSel.value;
    if (key && PRESETS[key]) {
      this.editor.value = PRESETS[key];
      this.presetSel.value = '';
      // Reset toolbar overrides for presets
      if (this.numberingSel) this.numberingSel.value = '';
      if (this.bitOrderSel)  this.bitOrderSel.value = '';
      this.update();
    }
  }

  // ── Resize ──
  startResize(e) {
    this.isResizing = true;
    this.resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }
  doResize(e) {
    if (!this.isResizing) return;
    const rect = document.getElementById('mainContainer').getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    this.leftPanel.style.width = Math.max(20, Math.min(75, pct)) + '%';
  }
  endResize() {
    if (!this.isResizing) return;
    this.isResizing = false;
    this.resizer.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    this.update();
  }

  // ── Tooltip ──
  showTooltip(e) {
    const rects = this.canvas._cellRects;
    if (!rects) return;
    const cr = this.canvas.getBoundingClientRect();
    const mx = e.clientX - cr.left;
    const my = e.clientY - cr.top;

    for (const r of rects) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        const c = r.cell;
        this.canvas.title = `${c.start}–${c.end}: ${c.label}`;
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }
    this.canvas.style.cursor = 'default';
    this.canvas.title = '';
  }

  // ── Double-click editing ──
  handleDblClick(e) {
    const rects = this.canvas._cellRects;
    if (!rects) return;
    const cr = this.canvas.getBoundingClientRect();
    const mx = e.clientX - cr.left;
    const my = e.clientY - cr.top;

    for (const r of rects) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        const cell = r.cell;
        const newLabel = prompt(`编辑字段 "${cell.label}" (${cell.start}–${cell.end}):`, cell.label);
        if (newLabel !== null && newLabel !== cell.label) {
          this.updateCellLabel(cell, newLabel);
        }
        return;
      }
    }
  }

  updateCellLabel(cell, newLabel) {
    const lines = this.editor.value.split(/\r?\n/);
    const lineIdx = cell.sourceLine;
    if (lineIdx >= 0 && lineIdx < lines.length) {
      let line = lines[lineIdx];
      // Replace the label portion (after colon, before options/comment)
      // Match:  start-end: OLD_LABEL [options] //comment
      const oldLabel = cell.label;
      // Escape for regex
      const escaped = oldLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Try to match the label in the source line
      // Pattern: whitespace* : whitespace* LABEL (with possible quotes)
      const re = new RegExp(`(:\\s*)("?)${escaped}("?)`);
      if (re.test(line)) {
        // If original had quotes, preserve them
        const needsQuotes = /["']/.test(line.match(re)[2]);
        const replacement = needsQuotes ? `$1"${newLabel}"` : `$1${newLabel}`;
        line = line.replace(re, replacement);
        lines[lineIdx] = line;
        this.editor.value = lines.join('\n');
        this.update();
        this.toast(`已更新: "${oldLabel}" → "${newLabel}"`);
      }
    }
  }

  // ── Export ──
  getParsed() {
    if (!this.currentSource) return null;
    try { return parsePacketDiag(this.currentSource, this.getUIOverrides()); }
    catch (e) { return null; }
  }

  exportPNG() {
    const parsed = this.getParsed();
    if (!parsed) return this.toast('无有效数据可导出');
    const tmpCanvas = document.createElement('canvas');
    renderToCanvas(parsed, tmpCanvas, { width: 1200 });
    tmpCanvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = 'packetdiag.png'; a.href = url; a.click();
      URL.revokeObjectURL(url);
      this.toast('PNG 已导出');
    }, 'image/png');
  }

  exportSVG() {
    const parsed = this.getParsed();
    if (!parsed) return this.toast('无有效数据可导出');
    const svg = generateSVG(parsed, { width: 1200 });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = 'packetdiag.svg'; a.href = url; a.click();
    URL.revokeObjectURL(url);
    this.toast('SVG 已导出');
  }

  exportHTML() {
    const parsed = this.getParsed();
    if (!parsed) return this.toast('无有效数据可导出');
    const html = generateHTMLExport(parsed, { width: 1200 });
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = 'packetdiag.html'; a.href = url; a.click();
    URL.revokeObjectURL(url);
    this.toast('HTML 已导出');
  }

  toast(msg) {
    const el = this.toastEl;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.remove('show'), 1800);
  }
}

// ──────────────────────────────────────
// 8. Boot
// ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  new PacketDiagViewer();
});
