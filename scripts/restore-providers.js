const fs = require('fs');
const path = require('path');

function jsToProviderTs(jsPath, tsPath, extraImports, implementsClause) {
  let js = fs.readFileSync(jsPath, 'utf8');
  js = js.replace(/\/\/# sourceMappingURL=.*$/m, '').trim();
  js = js.replace(/SidebarPanelProvider\.viewType = .*;\s*/g, '');
  js = js.replace(/TeamDashboardProvider\.viewType = .*;\s*/g, '');

  const marker = 'const vscode = __importStar(require("vscode"));';
  const start = js.indexOf(marker);
  if (start === -1) {
    throw new Error('vscode import not found in ' + jsPath);
  }
  let body = js.slice(start);
  body = body.replace(marker, "import * as vscode from 'vscode';");
  body = body.replace(/exports\.\w+ = \w+;\s*$/m, '');
  body = body.replace(/class (\w+)/, `export class $1 ${implementsClause}`);

  if (tsPath.includes('Sidebar')) {
    body = body.replace(
      /export class SidebarPanelProvider implements[^\n]+\{/,
      `export class SidebarPanelProvider ${implementsClause.split('implements ')[1]} {\n    public static readonly viewType = 'sessionRecap';\n    private _view?: vscode.WebviewView;\n    private _extensionUri: vscode.Uri;\n    private _fileClickCallback?: (filePath: string) => void;`
    );
  } else {
    body = body.replace(
      /export class TeamDashboardProvider implements[^\n]+\{/,
      `export class TeamDashboardProvider ${implementsClause.split('implements ')[1]} {\n    public static readonly viewType = 'teamDashboard';\n    private _view?: vscode.WebviewView;\n    private _extensionUri: vscode.Uri;\n    private _optInCallback?: () => void;\n    private _authenticateCallback?: () => void;`
    );
  }

  body = body.replace(/constructor\(extensionUri\)/g, 'constructor(extensionUri: vscode.Uri)');
  body = body.replace(/_getHtmlForWebview\(webview\)/g, '_getHtmlForWebview(webview: vscode.Webview)');
  body = body.replace(
    /resolveWebviewView\(webviewView, context, _token\)/g,
    'resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken)'
  );
  body = body.replace(
    /updateContent\(sessionData\)/g,
    'updateContent(sessionData: import(\'../models/SessionData\').SessionData)'
  );
  body = body.replace(
    /updateContent\(teamData\)/g,
    'updateContent(teamData: import(\'../interfaces/ITeamDataAggregator\').TeamSessionData)'
  );
  body = body.replace(/onFileClick\(callback\)/g, 'onFileClick(callback: (filePath: string) => void)');
  body = body.replace(/onOptIn\(callback\)/g, 'onOptIn(callback: () => void)');
  body = body.replace(/onAuthenticate\(callback\)/g, 'onAuthenticate(callback: () => void)');

  const header = extraImports + '\n\n';
  fs.writeFileSync(tsPath, header + body);
  console.log('Written', tsPath);
}

const root = path.join(__dirname, '..');

jsToProviderTs(
  path.join(root, 'out/providers/SidebarPanelProvider.js'),
  path.join(root, 'src/providers/SidebarPanelProvider.ts'),
  "import { ISidebarPanelProvider } from '../interfaces/ISidebarPanelProvider';",
  'implements ISidebarPanelProvider, vscode.WebviewViewProvider'
);

jsToProviderTs(
  path.join(root, 'out/providers/TeamDashboardProvider.js'),
  path.join(root, 'src/providers/TeamDashboardProvider.ts'),
  "import { ITeamDashboardProvider } from '../interfaces/ITeamDashboardProvider';",
  'implements ITeamDashboardProvider, vscode.WebviewViewProvider'
);
