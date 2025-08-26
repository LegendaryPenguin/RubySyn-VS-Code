// extension.ts
// VS Code extension entrypoint for "rubysyn-extension.codeGen"
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

function ensureUriFromContext(uri?: vscode.Uri): vscode.Uri | undefined {
  if (uri) return uri;
  const ed = vscode.window.activeTextEditor;
  return ed?.document?.uri;
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'rubysyn-extension.codeGen',
    async (clickedUri?: vscode.Uri) => {
      try {
        // 1) figure out which file was selected (or current editor)
        const fileUri = ensureUriFromContext(clickedUri);
        if (!fileUri) {
          vscode.window.showErrorMessage('No file selected or active.');
          return;
        }

        // only allow files on disk
        if (fileUri.scheme !== 'file') {
          vscode.window.showErrorMessage('Only local files are supported.');
          return;
        }

        const srcPath = fileUri.fsPath;
        if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isFile()) {
          vscode.window.showErrorMessage('Selected item is not a file.');
          return;
        }

        // 2) read file contents (utf8) and prepare base64 payload
        const raw = fs.readFileSync(srcPath, 'utf8');
        const b64 = Buffer.from(raw, 'utf8').toString('base64');

        // 3) compute a safe destination in WSL under ~/rbsyn/tmp_bench/
        const base = path.parse(srcPath).base.replace(/\s+/g, '_');
        const ts = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .replace('T', '_')
          .replace('Z', '');
        const baseWithTs =
          (base.endsWith('.rb') ? base.slice(0, -3) : base) + `_${ts}.rb`;

        const wslRepoRoot = '/home/nisch/rbsyn';
        const wslRelDir = 'tmp_bench';
        const wslRelPath = `${wslRelDir}/${baseWithTs}`;
        const wslAbsPath = `${wslRepoRoot}/${wslRelPath}`;

        // 4) create a WSL terminal and push a tiny script:
        //    - writes the base64 into /tmp,
        //    - decodes to ~/rbsyn/tmp_bench/<file>.rb
        //    - runs the rake bench with TEST= that file
        const term = vscode.window.createTerminal({
          name: 'RbSyn (WSL)',
          shellPath: 'wsl.exe',
        });
        term.show(true);

        // one carefully-quoted bash -lc block
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
          `RbSyn started for ${path.basename(srcPath)} → ${wslRelPath}`
        );
      } catch (e: any) {
        vscode.window.showErrorMessage(
          `RbSyn failed to start: ${e?.message ?? e}`
        );
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
