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
}`,
  standard: `packetdiag {
  colwidth = 32;
  node_height = 58;
  default_fontsize = 12;

  # === Demo: Full Standard PacketDiag Compatibility ===
  # This example exercises ALL standard syntax features

  # ---- Standard Field Attributes ----

  # 1. label attribute — display alias
  0-7: type [label = "Type", color = "#dbeafe"];

  # 2. number attribute — hide bit badge
  8-15: code [label = "Code", color = "#dcfce7", number = 0];

  # 3. style & shape — border and cell shape
  16-19: chksum [label = "Checksum", color = "#fef3c7", style = "dashed"];
  20-23: rsvd [label = "Reserved", color = "#ede9fe", style = "dotted"];

  # 4. description — hover tooltip
  24-31: ident [label = "Identifier", color = "#fee2e2", description = "Unique flow identifier assigned by the source"];

  # 5. shape = ellipse
  32-47: payload [label = "Payload", color = "#ccfbf1", shape = "ellipse"];

  # 6. len — variable-length field (jagged right edge)
  48-63: data [label = "Var Data", color = "#ffedd5", len = 64];

  # 7. background — override cell background
  64-79: flags [background = "#c7d2fe", label = "Flags", description = "Control flags bitmap"];

  # 8. icon & rotate
  80: F [label = "F", rotate = 270, icon = "flag"];
  81: S [label = "S", rotate = 270, icon = "sync"];
  82: R [label = "R", rotate = 270];
  83-95: unused [label = "Unused", style = "none", color = "#e5e7eb"];

  # 9. Sparse packet — gaps show dotted empty areas
  100-107: gap_fill [label = "After Gap", color = "#dbeafe"];

  # 10. scale config
  scale_direction = "left_to_right";
  scale_interval = 8;

  # ---- Description Table ----
  desctable {
    type = "Packet type identifier"
    code = "Operation code (request/response)"
    ident = "Flow identifier"
    payload = "Data payload (variable length)"
    data = "Variable-length data field"
    flags = "Control flags bitmap"
  }
}`
};