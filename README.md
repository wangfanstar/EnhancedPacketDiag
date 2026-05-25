# PacketDiag Offline Viewer

一个完全离线可用的 PacketDiag 预览工具：左侧输入 PacketDiag 源码，右侧实时渲染图片，并可导出 PNG。

## 打开方式

直接用浏览器打开 `index.html`。不需要本地服务、Node、Python、Kroki、CDN 或互联网连接。

## 基础用法

- 在左侧 `PacketDiag 源码` 中编辑协议字段。
- 右侧会自动刷新渲染结果。
- `示例` 可以切换内置 PacketDiag、TCP、IPv4、UDP、Ethernet 示例。
- `字号` 只调整源码编辑器字号，不改变导出图。
- `位序` 可选择 `0 -> 31` 或 `31 -> 0`。
- `编号` 可选择 `连续编号` 或 `每行独立`。
- `适配宽度` 打开时图片宽度跟随预览区域，关闭时使用较宽的固定画布。
- 点击 `导出 PNG` 可保存当前渲染图。
- 点击 `帮助` 可在页面内查看使用说明。

## 在图片中编辑字段文字

右侧预览图支持直接编辑字段文字：

- 双击任意字段块，会在图片上出现输入框。
- 输入框内容会实时同步回左侧 PacketDiag 源码。
- 按 `Enter` 或点击其他位置结束编辑。
- 按 `Esc` 取消本次编辑并恢复修改前的源码。

这个功能只修改字段 label，不会改变 bit 范围、颜色、旋转、`colheight` 等属性。

## 标准 PacketDiag 语法参考

本工具基于 [blockdiag/packetdiag](http://blockdiag.com/en/nwdiag/packetdiag-examples.html) 标准语法。以下列出完整的标准语法及本工具的扩展。

### 基本结构

```packetdiag
packetdiag {
  全局配置 ...
  位范围定义 ...
}
```

### 全局配置参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `colwidth` | 整数 | 32 | 每行显示的位宽。字段位号超出 colwidth 时自动折行 |
| `node_height` | 整数 (px) | 72 | 字段单元格高度 |
| `default_fontsize` | 整数 | 12 | 标签字体大小 |

### 位范围定义

格式：`bit[-end]: 标签 [属性, …]`

```packetdiag
0-3:   Version;                        // 多位字段
4-7:   IHL         [color = "#dbeafe"];  // 带颜色
8:     Single Bit;                        // 单个比特
16-31: Total Len   [textcolor = "red"];   // 文字颜色
96-111: "0x8100";                         // 特殊字符标签需引号
```

### 标准字段属性

| 属性 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `color` | 颜色值 | 单元格背景色，`#rrggbb` 或 CSS 颜色名 | `[color = "#fce5cd"]` |
| `textcolor` | 颜色值 | 标签文字颜色 | `[textcolor = "red"]` |
| `rotate` | 90 / 270 | 文字旋转角度 | `[rotate = 270]` |
| `colheight` | 整数 | 单元格高度倍数（1-12） | `[colheight = 3]` |

### 注释与区段

```packetdiag
// 注释行
0-31: Field;  // 行尾注释

// ---- 区段标题 ----
0-3: Version;
```

### 变体 / 备选格式

```packetdiag
// 变体 1: BFD上送
256-287: BFD_DISCR [color = "#fce5cd"];

// 变体 2: MOD上送
288-311: MOD_FIELD [color = "#fce5cd"];
```

## 本工具扩展（非标准语法）

以下功能为**本工具独有**，标准 PacketDiag / blockdiag / Kroki / PlantUML 中不可用：

### numbering — 编号模式

| 取值 | 行为 |
|------|------|
| `"global"`（默认） | 标准模式：位号全局唯一 |
| `"local"` | 每行独立：每行从 0 开始，多行可重复 `0-31` |

```packetdiag
numbering = "local";
```

### // @row — 显式行分隔

```packetdiag
// @row                  — 开始新行，无标签
// @row: Word 1          — 开始新行，标签 "Word 1"
```

### // @left: — 行注释

```packetdiag
// @left: 这段注释显示在下一行左侧
0-15: Source Port;
```

### bit_order — 位序反转

```packetdiag
bit_order = "asc";    // 默认：0 在左，31 在右
bit_order = "desc";   // 反转：31 在左，0 在右
```

### 双击编辑

双击预览图中任意字段可编辑标签文字，自动同步回源码。

### 全局注释

源码编辑器上方的文本区域，内容显示在图片左侧顶部。

## 与标准 PacketDiag 差异对照

| 特性 | 标准 | 本工具 |
|------|:--:|:--:|
| 字段定义 `bit: label` / `bit-end: label` | ✅ | ✅ |
| `color` / `textcolor` / `rotate` / `colheight` | ✅ | ✅ |
| `colwidth` / `node_height` / `default_fontsize` | ✅ | ✅ |
| `//` 注释 / `// ----` 区段 / 变体标记 | ✅ | ✅ |
| 多行字段（跨 colwidth 折行） | ✅ 含虚线 | ✅ 不含虚线 |
| `#` 注释 | ✅ | 🔴 |
| `@startpacketdiag` / `@endpacketdiag` | ✅ PlantUML | 🔴 |
| `scale_direction` / `scale_interval` | ✅ | 🔴 |
| `label` 字段属性 (别名) | ✅ | 🔴（双击代替） |
| `number` 徽章 / `description` 提示 | ✅ | 🔴 |
| `style` 边框 / `shape` 形状 | ✅ | 🔴 |
| `icon` / `background` / `stacked` | ✅ | 🔴 |
| `len` 变长字段 / Sparse packet | ✅ | 🔴 |
| `desctable` 描述表 | ✅ Sphinx | 🔴 |
| `numbering = "local"` | 🔴 | 🟢 独有 |
| `// @row` 行分隔 | 🔴 | 🟢 独有 |
| `// @left:` 行注释 | 🔴 | 🟢 独有 |
| `bit_order = "desc"` | 🔴 | 🟢 独有 |
| 工具栏位序/编号覆盖 | 🔴 | 🟢 独有 |
| 双击图片编辑字段 | 🔴 | 🟢 独有 |
| 全局注释输入框 | 🔴 | 🟢 独有 |
| 完全离线运行 | 🔴 需 Kroki/Python | 🟢 离线 |

## 常见问题

- 页面空白：确认 `index.html` 和 `assets/` 目录在同一位置
- 中文乱码：确认文件以 UTF-8 保存
- 位序没有反向：检查工具栏「位序」或源码 `bit_order`
- 注释没有显示：`// @left:` 需写在目标字段**前面**
- local 模式报错：字段位号必须 `< colwidth`
