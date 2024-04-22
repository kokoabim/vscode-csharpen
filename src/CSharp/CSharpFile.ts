import "../Extensions/Array.extensions";
import { CSharpSymbol } from './CSharpSymbol';
import { CSharpSymbolType } from './CSharpSymbolType';
import { FileDiagnostic, FileDiagnosticIdentifier } from "../Models/FileDiagnostic";
import { FileSystem } from '../Utils/FileSystem';
import * as vscode from 'vscode';
import util from 'node:util';

export class CSharpFile {
    static readonly zeroPosition = new vscode.Position(0, 0);

    readonly filePath: string;
    readonly name: string;
    readonly namespace = undefined;
    readonly parent = undefined;
    readonly type = CSharpSymbolType.file;

    children: CSharpSymbol[] = [];

    private constructor(public readonly textDocument: vscode.TextDocument) {
        this.filePath = vscode.workspace.asRelativePath(textDocument.uri);
        this.name = FileSystem.fileName(textDocument);
        this.textDocument = textDocument;
    }

    get hasChildren(): boolean { return this.children.length > 0; }

    get text(): string {
        return this.hasChildren ? CSharpSymbol.join(this.children) : "";
    }

    static async create(textDocument: vscode.TextDocument): Promise<CSharpFile> {
        const csharpFile = new CSharpFile(textDocument);
        csharpFile.children = await CSharpFile.parseSymbols(textDocument);
        return csharpFile;
    }

    static getFileDiagnostics(document: vscode.TextDocument): FileDiagnostic[] {
        return vscode.languages.getDiagnostics(document.uri).filter(d => !d.source || d.source === "csharp").map(d => new FileDiagnostic(FileSystem.fileName(document), d));
    }

    static async removeUnusedUsings(textEditor: vscode.TextEditor, textDocument: vscode.TextDocument): Promise<boolean> {
        const fileDiagnostics = this.getFileDiagnostics(textDocument);
        const unusedUsings = fileDiagnostics.filter(d => d.identifier === FileDiagnosticIdentifier.usingDirectiveUnnecessary);
        if (unusedUsings.length === 0) return Promise.resolve(false);

        const edits = unusedUsings.sort((a, b) => {
            return (a.range.start.line === b.range.start.line) ? b.range.start.character - a.range.start.character : b.range.start.line - a.range.start.line;
        }).map(d => {
            const whitespaceRange = new vscode.Range(d.range.end, new vscode.Position(d.range.end.line + 1, 0));
            const isWhitespace = textDocument.getText(whitespaceRange).match('^\\s+$');
            const textEdit = new vscode.TextEdit(isWhitespace ? new vscode.Range(d.range.start, whitespaceRange.end) : d.range, "");
            return textEdit;
        });

        await textEditor.edit(editBuilder => {
            edits.forEach(t =>
                editBuilder.replace(t.range, t.newText)
            );
        });

        return Promise.resolve(true);
    }

    [util.inspect.custom](): string {
        return `${CSharpSymbolType[this.type]}${this.hasChildren ? `[${this.children.length}]` : ""}: ${FileSystem.fileName(this.textDocument)}`;
    }

    debug(): void {
        console.log(`${CSharpSymbolType[this.type]}: name=${this.name}, path=${this.filePath}`);
        if (this.hasChildren) this.children.forEach(c => c.debug());
    }

    private static async parseSymbols(textDocument: vscode.TextDocument): Promise<CSharpSymbol[]> {
        const documentSymbols = await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", textDocument.uri).then(symbols => symbols as vscode.DocumentSymbol[] || []);
        if (documentSymbols.length === 0) return [];

        const symbols = CSharpSymbol.createSymbols(textDocument, documentSymbols);
        const usingAndNamespaceSymbols = CSharpSymbol.createUsingAndNamespaceSymbols(textDocument, symbols);

        CSharpSymbol.addUsingAndNamespaceSymbols(usingAndNamespaceSymbols, symbols);
        CSharpSymbol.createNonCodeblockSymbols(textDocument, usingAndNamespaceSymbols, symbols);

        return symbols;
    }
}
