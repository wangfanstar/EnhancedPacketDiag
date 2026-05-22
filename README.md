# EnhancedPacketDiag

离线可用的网络报文结构图编辑器 —— 在浏览器中编写 PacketDiag 语法，实时生成报文头部示意图。

## 功能

- **实时编辑预览** — 左侧编写 PacketDiag 源码，右侧 Canvas 实时渲染
- **双编号模式** — `global`（连续编号）与 `local`（每行独立编号），工具栏可随时切换
- **位序反转** — 支持 `bit_order = "desc"`，位号从右到左排列，匹配协议规范图
- **显式行控制** — `// @row` 分隔行，`// @row: label` 添加行标签，`// @left:` 添加左侧注释
- **变体/备选格式** — 同一比特位的不同解释方式以独立行展示
- **双击编辑** — 双击图中字段即可修改标签文字，自动同步回源码
- **多格式导出** — PNG（位图）、SVG（矢量图）、HTML（离线独立文件）
- **完全离线** — 无 CDN / 无外部依赖，直接双击 `index.html` 即可使用

## 使用方式

1. 浏览器打开 `index.html`
2. 左侧编写 PacketDiag 源码（或从预设中选择示例）
3. 右侧实时预览渲染结果
4. 点击「? 语法帮助」查看完整语法参考

## 快速示例

### 连续编号 (global)
```
packetdiag {
  colwidth = 32;
  node_height = 48;

  // ---- IPv4 Header ----
  0-3:   Version    [color = "#a8d8ea"];
  4-7:   IHL        [color = "#a8d8ea"];
  8-15:  DSCP       [color = "#b5e8c3"];
  16-31: Total Len  [color = "#f5d6a8"];
}
```

### 每行独立编号 (local)
```
packetdiag {
  colwidth = 32;
  numbering = "local";

  // @row: Word 1
  0-15: Source Port;
  16-31: Dest Port;

  // @row: Word 2
  0-31: Sequence Number;
}
```

## 文件结构

- `index.html` — 主页面，包含语法帮助弹窗
- `packetdiag.css` — 深色主题样式表
- `packetdiag.js` — 解析器、Canvas/SVG 渲染器、UI 控制逻辑
- `packet.md` — 示例源码

## 语法参考

点击界面工具栏「? 语法帮助」查看完整语法文档，涵盖：
- 配置参数（colwidth, node_height, numbering, bit_order 等）
- 位范围定义与选项（color, textcolor）
- 区段标题、变体、@row/@left 指令
- 完整 IPv4 / TCP / UDP / Ethernet 示例
