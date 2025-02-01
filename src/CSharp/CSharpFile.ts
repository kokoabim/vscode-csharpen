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
        this.name = FileSystem.fileNameUsingTextDocument(textDocument);
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

    static getFileDiagnosticsUsingTextDocument(document: vscode.TextDocument): FileDiagnostic[] {
        return vscode.languages.getDiagnostics(document.uri).map(d => new FileDiagnostic(FileSystem.fileNameUsingTextDocument(document), d));
    }

    static getFileDiagnosticsUsingUri(uri: vscode.Uri): FileDiagnostic[] {
        return vscode.languages.getDiagnostics(uri).map(d => new FileDiagnostic(FileSystem.fileNameUsingUri(uri), d));
    }

    static async removeUnusedUsings(textEditor: vscode.TextEditor): Promise<number> {
        const fileDiagnostics = this.getFileDiagnosticsUsingTextDocument(textEditor.document);
        const unusedUsings = fileDiagnostics.filter(d => d.identifier === FileDiagnosticIdentifier.usingDirectiveUnnecessary);
        if (unusedUsings.length === 0) return 0;

        const edits = unusedUsings.sort((a, b) => {
            return (a.range.start.line === b.range.start.line) ? b.range.start.character - a.range.start.character : b.range.start.line - a.range.start.line;
        }).map(d => {
            const whitespaceRange = new vscode.Range(d.range.end, new vscode.Position(d.range.end.line + 1, 0));
            const isWhitespace = textEditor.document.getText(whitespaceRange).match('^\\s+$');
            const textEdit = new vscode.TextEdit(isWhitespace ? new vscode.Range(d.range.start, whitespaceRange.end) : d.range, "");
            return textEdit;
        });

        await textEditor.edit(editBuilder => {
            edits.forEach(t =>
                editBuilder.replace(t.range, t.newText)
            );
        });

        return unusedUsings.length;
    }

    [util.inspect.custom](): string {
        return `${CSharpSymbolType[this.type]}${this.hasChildren ? `[${this.children.length}]` : ""}: ${FileSystem.fileNameUsingTextDocument(this.textDocument)}`;
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
