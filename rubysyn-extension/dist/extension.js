"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
function ensureUriFromContext(uri) {
  if (uri) return uri;
  const ed = vscode.window.activeTextEditor;
  return ed?.document?.uri;
}
function activate(context) {
  const disposable = vscode.commands.registerCommand(
    "rubysyn-extension.codeGen",
    async (clickedUri) => {
      try {
        const fileUri = ensureUriFromContext(clickedUri);
        if (!fileUri) {
          vscode.window.showErrorMessage("No file selected or active.");
          return;
        }
        if (fileUri.scheme !== "file") {
          vscode.window.showErrorMessage("Only local files are supported.");
          return;
        }
        const srcPath = fileUri.fsPath;
        if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isFile()) {
          vscode.window.showErrorMessage("Selected item is not a file.");
          return;
        }
        const raw = fs.readFileSync(srcPath, "utf8");
        const b64 = Buffer.from(raw, "utf8").toString("base64");
        const base = path.parse(srcPath).base.replace(/\s+/g, "_");
        const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
        const baseWithTs = (base.endsWith(".rb") ? base.slice(0, -3) : base) + `_${ts}.rb`;
        const wslRepoRoot = "/home/nisch/rbsyn";
        const wslRelDir = "tmp_bench";
        const wslRelPath = `${wslRelDir}/${baseWithTs}`;
        const wslAbsPath = `${wslRepoRoot}/${wslRelPath}`;
        const term = vscode.window.createTerminal({
          name: "RbSyn (WSL)",
          shellPath: "wsl.exe"
        });
        term.show(true);
        const wslScript = `
bash -lc '
  set -euo pipefail
  echo "[RbSyn] Writing input to ${wslAbsPath}"
  mkdir -p "${wslRepoRoot}/${wslRelDir}"

  # stash base64 temporarily
  cat > /tmp/rbsyn_input.b64 << "EOF_RBSYN"
${b64}
EOF_RBSYN

  # decode into the repo
  base64 -d /tmp/rbsyn_input.b64 > "${wslAbsPath}"
  rm -f /tmp/rbsyn_input.b64

  echo "[RbSyn] Running bench on ${wslRelPath}"
  cd "${wslRepoRoot}"
  CONSOLE_LOG=1 bundle exec rake bench TEST="${wslRelPath}"
'`.trim();
        term.sendText(wslScript);
        vscode.window.showInformationMessage(
          `RbSyn started for ${path.basename(srcPath)} \u2192 ${wslRelPath}`
        );
      } catch (e) {
        vscode.window.showErrorMessage(
          `RbSyn failed to start: ${e?.message ?? e}`
        );
      }
    }
  );
  context.subscriptions.push(disposable);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
