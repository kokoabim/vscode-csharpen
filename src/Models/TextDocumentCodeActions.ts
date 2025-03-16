import * as vscode from "vscode";

import { DocumentSymbolCodeActions } from "./DocumentSymbolCodeActions";

export class TextDocumentCodeActions {
    constructor(public textDocument: vscode.TextDocument, public children: DocumentSymbolCodeActions[] = []) { }

    public get hasAny(): boolean { return this.children.length > 0 && this.children.some(c => c.hasAny); }
}
