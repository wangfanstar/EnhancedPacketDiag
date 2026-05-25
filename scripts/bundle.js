"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const htmlPath = path.join(root, "index.html");
const cssPath = path.join(root, "assets", "styles.css");
const jsPath = path.join(root, "assets", "app.js");

const css = fs.readFileSync(cssPath, "utf8");
const js = fs.readFileSync(jsPath, "utf8");
let html = fs.readFileSync(htmlPath, "utf8");

const styleTag = `  <style>\n${css}\n  </style>`;
const scriptTag = `  <script>\n${js}\n  </script>`;

if (html.includes('href="assets/styles.css"')) {
  html = html.replace('  <link rel="stylesheet" href="assets/styles.css">', styleTag);
} else {
  html = html.replace(/  <style>[\s\S]*?<\/style>/, styleTag);
}

html = html.replace(/\n  <script defer src="assets\/app.js"><\/script>/, "");
html = html.replace(/\n  <script>\n[\s\S]*?\n  <\/script>\n(?=<\/head>)/, "");
html = html.replace(/\n  <script>\n[\s\S]*?\n  <\/script>\n(?=<\/body>)/, "");
html = html.replace("</body>", `\n${scriptTag}\n</body>`);

fs.writeFileSync(htmlPath, html, "utf8");
console.log(`Bundled ${htmlPath}`);
