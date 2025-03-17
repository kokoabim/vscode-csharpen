import * as vscode from "vscode";

export class DocumentSymbolCodeActions {
    public readonly children: DocumentSymbolCodeActions[] = [];

    constructor(public readonly documentSymbol: vscode.DocumentSymbol, public codeActions: vscode.CodeAction[] = []) { }

    public get count(): number { return this.codeActions.length + this.children.reduce((a, c) => a + c.count, 0); }

    public get hasAny(): boolean { return this.codeActions.length > 0 || this.children.some(c => c.hasAny); }
}
