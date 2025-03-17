import * as vscode from "vscode";

import { DocumentSymbolCodeActions } from "./DocumentSymbolCodeActions";

export class TextDocumentCodeActions {
    constructor(public readonly textDocument: vscode.TextDocument, public readonly children: DocumentSymbolCodeActions[] = []) { }

    public get count(): number { return this.children.reduce((a, c) => a + c.count, 0); }

    public get hasAny(): boolean { return this.children.length > 0 && this.children.some(c => c.hasAny); }
}
