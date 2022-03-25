import { accessSync, constants, lstatSync } from 'fs';
import * as vscode from 'vscode';
import cp = require('child_process')

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider({ scheme: "file", language: "go" }, new Semicolonzer(), {
			providedCodeActionKinds: Semicolonzer.providedCodeActionKinds
		})
	);
}

/**
 * Provides code actions for converting :) to a smiley semi.
 */
export class Semicolonzer implements vscode.CodeActionProvider {

	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.Refactor
	];

	public provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, ctx: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] | undefined {
		let binPath = this.findImplBin()
		if (!binPath) {
			return
		}

		let match = this.isImplTokenize(document, range)
		if (!match) {
			return;
		}

		let startIndex = 0
		for (let lineIndex = range.end.line; lineIndex < document.lineCount; lineIndex++) {
			let text = document.lineAt(lineIndex).text
			if (text.startsWith("}")) {
				startIndex = lineIndex
				break
			}
		}
		const implInterface = this.createFix(document, new vscode.Range(new vscode.Position(startIndex + 2, 0), range.end), match[1], match[2], binPath);
		implInterface.isPreferred = true

		return [
			implInterface,
		];
	}

	private isImplTokenize(document: vscode.TextDocument, range: vscode.Range) {
		const end = range.end;
		const line = document.lineAt(end.line);
		return line.text.trim().match(/^\/\/\s+(.*?)\s+\@impl\s+(.*?)$/)
	}

	private createFix(document: vscode.TextDocument, range: vscode.Range, receiver: String, interfaces: String, binPath: string): vscode.CodeAction {
		let title = `Implement ${receiver} ${interfaces}`
		var fix = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
		fix.edit = new vscode.WorkspaceEdit();

		let args = [`${receiver.charAt(0).toLowerCase()} *${receiver}`, `${interfaces}`]
		let out = cp.execFileSync(
			binPath,
			args,
			{},
		)
		fix.edit.insert(document.uri, new vscode.Position(range.end.line, 0), out.toString())
		return fix;
	}

	private findImplBin() {
		let path = ""
		if (process.env.GOBIN) {
			path = process.env.GOBIN + "/impl"
		} else if (process.env.GOPATH) {
			path = process.env.GOPATH + "/bin/impl"
		}

		let exist = false;
		try {
			exist = lstatSync(path).isFile()
			if (exist) {
				accessSync(path, constants.F_OK | constants.X_OK)
			}
		} catch (e) {
			exist = false
		}

		return exist ? path : ""
	}
}
