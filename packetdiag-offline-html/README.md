# PacketDiag Offline Viewer

一个完全离线可用的 PacketDiag 预览工具：左侧输入 PacketDiag 源码，右侧实时渲染图片，并可导出 PNG。

## 打开方式

直接用浏览器打开 `index.html`：

```text
E:\MCP_PROJECT\PacketDiagEnhanced\packetdiag-offline-html\index.html
```

不需要本地服务、Node、Python、Kroki、CDN 或互联网连接。

## 基础用法

- 在左侧 `PacketDiag 源码` 中编辑协议字段。
- 右侧会自动刷新渲染结果。
- `示例` 可以切换内置 PacketDiag、TCP、IPv4、UDP、Ethernet 示例。
- `字号` 只调整源码编辑器字号，不改变导出图。
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

## 支持的 PacketDiag 语法

```packetdiag
packetdiag {
  colwidth = 32;
  node_height = 40;
  default_fontsize = 12;
  bit_order = "desc";

  // ---- Section Title ----
  // @left: 这段文字会显示在下一条字段所在行的左侧
  0-15: Source Port [color = "#dbeafe"];
  16-31: Destination Port [textcolor = "red"];
  32-63: Sequence Number;
}
```

已支持：

- `colwidth`
- `node_height`
- `default_fontsize`
- `bit_order = "asc"` 或 `bit_order = "desc"`
- 单 bit：`154: NS_E;`
- bit 范围：`0-31: HOST_MAC;`
- quoted label：`96-111: "0x8100";`
- 字段属性：`color`、`textcolor`、`rotate = 270`、`colheight`
- 区段标题注释：`// ---- 标题 ----`
- 左侧行注释：`// @left: 注释文字`
- 兼容原有变体行标签：`// 变体 1: ...`

## 反向位序

有两种方式可以显示为 `31 -> 0`：

1. 源码配置：

```packetdiag
bit_order = "desc";
```

2. 工具栏 `位序` 下拉框选择 `31 -> 0`。

优先级：工具栏显式选择 `0 -> 31` 或 `31 -> 0` 会覆盖源码；选择 `跟随源码` 时使用 `bit_order`，源码未配置时默认 `0 -> 31`。

反向位序只改变每个 `colwidth` 行内的显示方向，不改变源码中的 bit 编号和字段含义。

## 左侧注释

左侧注释有两种来源：

- `全局注释` 输入框：显示在导出图片左侧顶部，不写回源码。
- 源码注释：使用 `// @left: 注释文字`，作用于下一条字段所在行。

示例：

```packetdiag
// @left: Word 0，基础 MAC 字段
0-31: HOST_MAC;

// @left: Word 1，HOST_MAC 低 16 bit + NP_MAC 高 16 bit
32-47: HOST_MAC;
48-63: NP_MAC;
```

PNG 导出会包含当前全局注释、行注释和位序效果。

## 常见问题

- 页面空白：确认打开的是 `packetdiag-offline-html/index.html`，并且 `assets/app.js` 和 `assets/styles.css` 与它保持同级目录结构。
- 中文乱码：请确认文件以 UTF-8 保存。
- 位序没有反向：检查工具栏 `位序` 是否选择了 `跟随源码`，以及源码中是否配置了 `bit_order = "desc"`。
- 注释没有显示：`// @left:` 需要写在目标字段前面，作用于下一条字段所在行。
