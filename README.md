# PacketDiag Offline Viewer

一个完全离线可用的 PacketDiag 预览工具：左侧输入 PacketDiag 源码，右侧实时渲染图片，并可导出 PNG。

## 打开方式

- **开发版**：打开根目录 `index.html`（加载 `assets/js/` 模块与 `assets/styles.css`），或运行 `npx serve .`
- **离线单文件版**：运行 `npm run build` 后打开 `dist/index.html`，可在 `file://` 下直接使用

## 项目结构

```
index.html              # 页面结构（开发入口）
assets/
  styles.css            # 样式
  js/
    presets.js          # 内置示例数据
    parse.js            # PacketDiag 解析
    render.js           # Canvas 渲染
    ui.js               # 交互与初始化
dist/
  index.html            # 构建产物（CSS/JS 内联，npm run build 生成）
scripts/
  bundle.js             # 打包脚本
```

修改源码后运行 `npm run build` 更新 `dist/index.html`。

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

支持两种块格式：

```packetdiag
packetdiag {
  全局配置 ...
  位范围定义 ...
}
```

或 PlantUML 格式：

```packetdiag
@startpacketdiag
packetdiag {
  全局配置 ...
  位范围定义 ...
}
@endpacketdiag
```

### 全局配置参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `colwidth` | 整数 | 32 | 每行显示的位宽。字段位号超出 colwidth 时自动折行 |
| `node_height` | 整数 (px) | 72 | 字段单元格高度 |
| `default_fontsize` | 整数 | 12 | 标签字体大小 |
| `scale_direction` | 字符串 | `left_to_right` | 标尺方向：`left_to_right`（0在左）或 `right_to_left`（最大值在左） |
| `scale_interval` | 整数 | 8 | 标尺主刻度间隔（默认每 8 bit 一个主刻度） |

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
| `label` | 字符串 | 字段显示别名（可替代标签文本） | `[label = "Source Port"]` |
| `number` | 布尔 | 是否显示位号徽章（默认显示） | `[number = 0]` |
| `description` | 字符串 | 鼠标悬停提示文本 | `[description = "RFC 793"]` |
| `style` | 字符串 | 边框样式：`solid`（默认）、`dashed`、`dotted`、`none` | `[style = "dashed"]` |
| `shape` | 字符串 | 单元格形状：`box`（默认）、`ellipse` | `[shape = "ellipse"]` |
| `len` | 整数 | 变长字段标记，右侧锯齿边缘 | `[len = 64]` |
| `icon` | 字符串 | 单元格右上角图标徽章 | `[icon = "flag"]` |
| `background` | 颜色值 | 单元格背景色（比 `color` 优先级更高） | `[background = "#c7d2fe"]` |

### 注释与区段

支持 `#` 和 `//` 两种注释风格：

```packetdiag
# 井号注释行（标准 PacketDiag）
// 双斜杠注释行
0-31: Field;  # 行尾注释
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

### 变长字段 `len`

```packetdiag
0-31: Data [len = 64];
```

`len = N` 标记该字段为变长字段，渲染时右侧边缘显示锯齿状标记，角落标注 `len=N`。

### 稀疏报文 (Sparse Packet)

字段无需覆盖全部位号，未覆盖的位域会自动显示为浅色空白区（虚线点标注）。这与标准 PacketDiag 的行为一致。

```packetdiag
0-15: Header;     # 覆盖 0-15
32-47: Payload;   # 16-31 自动显示为空白区
```

### 描述表 `desctable`

在 `packetdiag { }` 块内使用 `desctable { }` 块为字段添加描述，渲染时在图表下方生成描述表：

```packetdiag
packetdiag {
  0-15: SrcPort [description = "TCP source port"];
  16-31: DstPort [description = "TCP dest port"];

  desctable {
    SrcPort = "发送方端口号（16 bits）"
    DstPort = "接收方端口号（16 bits）"
  }
}
```

字段的 `[description = "..."]` 属性也会被自动收录到描述表中。

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
| `label` 字段属性（显示别名） | ✅ | ✅ |
| `number` 位号徽章 / `description` 提示 | ✅ | ✅ 提示为 tooltip |
| `style` 边框样式（none/solid/dashed/dotted） | ✅ | ✅ |
| `shape` 形状（box/ellipse） | ✅ | ✅ |
| `colwidth` / `node_height` / `default_fontsize` | ✅ | ✅ |
| `scale_direction` / `scale_interval` | ✅ | ✅ |
| `#` 注释 / `//` 注释 | ✅ | ✅ 两种均可 |
| `// ----` 区段 / 变体标记 | ✅ | ✅ |
| `@startpacketdiag` / `@endpacketdiag` | ✅ PlantUML | ✅ |
| 多行字段（跨 colwidth 折行） | ✅ 含虚线 | ✅ 不含虚线 |
| `icon` 徽章标记 / `background` 背景色 | ✅ | ✅ |
| `len` 变长字段标记 | ✅ | ✅ 锯齿边缘 + len=N 标注 |
| Sparse packet（稀疏报文，字段不连续覆盖） | ✅ | ✅ 空白位域虚线标注 |
| `desctable` 描述表 | ✅ Sphinx | ✅ 图表下方渲染表格 |
| 多行字段（跨 colwidth 折行） | ✅ 含虚线 | ✅ 不含虚线 |
| `stacked` 堆叠模式 | ✅ | 🔴 |
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
