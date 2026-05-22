# 图像
```
packetdiag {
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
}
```