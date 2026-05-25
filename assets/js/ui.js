const dom = {
  editor: document.getElementById("editor"),
  canvas: document.getElementById("diagramCanvas"),
  errorMessage: document.getElementById("errorMessage"),
  statusInfo: document.getElementById("statusInfo"),
  presetSelect: document.getElementById("presetSelect"),
  previewWrap: document.getElementById("previewWrap"),
  fitWidth: document.getElementById("fitWidth"),
  bitOrderMode: document.getElementById("bitOrderMode"),
  numberingMode: document.getElementById("numberingMode"),
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

function update() {
  currentSource = dom.editor.value;
  try {
    const firstPass = parsePacketDiag(currentSource);
    const bitOrder = getEffectiveBitOrder(firstPass);
    const numbering = getEffectiveNumbering(firstPass);
    const needsReparse = numbering !== firstPass.config.numbering || bitOrder !== firstPass.config.bit_order;
    const parsed = needsReparse
      ? parsePacketDiag(currentSource, { numbering, bit_order: bitOrder })
      : firstPass;
    lastParsed = parsed;
    const availableWidth = Math.max(560, dom.previewWrap.clientWidth - 48);
    const layout = renderDiagram(parsed, dom.canvas, {
      width: dom.fitWidth.checked ? availableWidth : 1040,
      fitWidth: dom.fitWidth.checked,
      bitOrder,
      globalNote: dom.globalNote.value
    });
    const warningText = parsed.warnings.length > 0 ? `警告: ${parsed.warnings.join("；")}` : "";
    dom.errorMessage.value = warningText;
    dom.errorMessage.textContent = warningText;

    if (parsed.sections.length === 0 && (!parsed.descTable || parsed.descTable.length === 0)) {
      dom.statusInfo.textContent = "等待输入";
      return;
    }

    if (parsed.sections.length === 0) {
      dom.statusInfo.textContent = `描述表 ${parsed.descTable.length} 项, ${layout.width}x${layout.height}`;
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
    renderDiagram({ config: sanitizeConfig({}), sections: [], fields: [], descTable: [] }, dom.canvas, {
      width: Math.max(560, dom.previewWrap.clientWidth - 48),
      bitOrder: "asc",
      globalNote: "",
      numbering: "global"
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

function getEffectiveNumbering(parsed) {
  const mode = dom.numberingMode?.value;
  if (mode === "global" || mode === "local") {
    return mode;
  }
  return parsed?.config?.numbering === "local" ? "local" : "global";
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
  const displayLabel = getDisplayLabel(field);
  const canvasRect = dom.canvas.getBoundingClientRect();
  const wrapRect = dom.previewWrap.getBoundingClientRect();
  const input = document.createElement("input");
  input.type = "text";
  input.className = "canvas-label-editor";
  input.value = displayLabel;
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
    originalLabel: displayLabel,
    currentLabel: displayLabel,
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
    return expectedLabel === null
      || parsed.label === expectedLabel
      || String(parsed.options.label || "") === expectedLabel;
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

  let labelText = body;
  let optionsText = "";
  if (body.endsWith("]")) {
    const optionStart = findTrailingOptionStart(body);
    if (optionStart >= 0) {
      const rawOptions = body.slice(optionStart + 1, -1).trim();
      if (/[A-Za-z_]\w*\s*=/.test(rawOptions)) {
        labelText = body.slice(0, optionStart).trim();
        optionsText = body.slice(optionStart).trim();
      }
    }
  }

  // If the field has a label= option, update that; otherwise update the main label
  let updatedOptions = optionsText;
  if (optionsText && /\blabel\s*=/.test(optionsText)) {
    updatedOptions = optionsText.replace(
      /(\blabel\s*=\s*)(?:"([^"]*)"|'([^']*)'|(\S+))/,
      (fullMatch, key, dqVal, sqVal, bareVal) => {
        const currentVal = dqVal ?? sqVal ?? bareVal ?? "";
        const quoted = dqVal !== undefined ? '"' : (sqVal !== undefined ? "'" : "");
        return `${key}${quoted}${nextLabel}${quoted}`;
      }
    );
    const newCode = `${prefix}${formatLabelForSource(labelText)} ${updatedOptions}${semicolon}${trailingWhitespace}`;
    return comment ? `${newCode}${comment}` : newCode;
  }

  const newCode = `${prefix}${formatLabelForSource(nextLabel)}${optionsText ? ` ${optionsText}` : ""}${semicolon}${trailingWhitespace}`;
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
    const desc = field.options.description ? `\n${field.options.description}` : "";
    dom.canvas.title = `${field.start}-${field.end}: ${getDisplayLabel(field)}${desc}，双击可编辑`;
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
  dom.numberingMode.value = "source";
  dom.editor.style.fontSize = `${dom.editorFontSize.value}px`;

  dom.presetSelect.addEventListener("change", () => {
    closeCanvasLabelEditor(false);
    const source = PRESETS[dom.presetSelect.value];
    if (source) {
      dom.editor.value = source;
      dom.numberingMode.value = "source";
      update();
    }
  });

  dom.editor.addEventListener("input", () => {
    closeCanvasLabelEditor(false);
    scheduleUpdate();
  });
  dom.fitWidth.addEventListener("change", update);
  dom.bitOrderMode.addEventListener("change", update);
  dom.numberingMode.addEventListener("change", update);
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}