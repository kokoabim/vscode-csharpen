import * as vscode from "vscode";

export class DocumentSymbolCodeActions {
    children: DocumentSymbolCodeActions[] = [];

    constructor(public documentSymbol: vscode.DocumentSymbol, public codeActions: vscode.CodeAction[] = []) { }

    public get hasAny(): boolean { return this.codeActions.length > 0 || this.children.some(c => c.hasAny); }
}
