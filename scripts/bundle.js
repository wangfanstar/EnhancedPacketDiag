"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcHtmlPath = path.join(root, "index.html");
const cssPath = path.join(root, "assets", "styles.css");
const distDir = path.join(root, "dist");
const distHtmlPath = path.join(distDir, "index.html");

const jsFiles = [
  "assets/js/utils.js",
  "assets/js/presets.js",
  "assets/js/parse.js",
  "assets/js/render.js",
  "assets/js/ui.js"
];

const css = fs.readFileSync(cssPath, "utf8");
const js = jsFiles
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n\n");

let html = fs.readFileSync(srcHtmlPath, "utf8");

html = html.replace(/  <link rel="stylesheet" href="assets\/styles.css">\n/, "");
html = html.replace(/  <script defer src="assets\/js\/[^"]+"><\/script>\n/g, "");

const styleTag = `  <style>\n${css}\n  </style>\n`;
const scriptTag = `  <script>\n${js}\n  </script>\n`;

html = html.replace("</head>", `${styleTag}</head>`);
html = html.replace("</body>", `${scriptTag}</body>`);

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(distHtmlPath, html, "utf8");
console.log(`Built ${distHtmlPath} (${html.split("\n").length} lines)`);
