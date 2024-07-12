import { CSharpenVSCodeExtensionSettings } from "./CSharpenVSCodeExtensionSettings";
import { CSharpFile } from '../CSharp/CSharpFile';
import { CSharpOrganizer } from "../CSharp/CSharpOrganizer";
import { FileDiagnostic, FileDiagnosticSeverity } from "../Models/FileDiagnostic";
import { FileFilter, FileFilterStatus } from "../Models/FileFilter";
import { VSCodeCommand } from "./VSCodeCommand";
import { VSCodeExtension } from "./VSCodeExtension";
import * as vscode from "vscode";
// import { CSharpProjectFile } from "../CSharp/CSharpProjectFile";
import { FileSystem } from "../Utils/FileSystem";

/**
 * CSharpen — C# File Organizer VS Code extension
 */
export class CSharpenVSCodeExtension extends VSCodeExtension {
    constructor(context: vscode.ExtensionContext) {
        super(context);

        this.addCommands(
            this.createOutputFileDiagnosticsCommand(),
            // this.createOutputFileDiagnosticsForProjectCommand(),
            this.createRemoveUnusedUsingsCommand(),
            this.createSharpenFileCommand());
    }

    static use(context: vscode.ExtensionContext): CSharpenVSCodeExtension {
        return new CSharpenVSCodeExtension(context);
    }

    private createOutputFileDiagnosticsCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.output-file-diagnostics", async () => {
            if (!await super.isWorkspaceReady()) { return; }

            const textDocument = await this.getTextDocument();
            if (!textDocument) { return; }

            this.clearOutput();

            this.outputTextDocumentCodeActions(await this.getTextDocumentCodeActions(textDocument));

            const fileDiagnostics = CSharpFile.getFileDiagnosticsUsingTextDocument(textDocument);
            if (fileDiagnostics.length === 0) {
                await this.information("No diagnostics found.");
                return;
            }

            this.outputFileDiagnostics(fileDiagnostics);
        });
    }

    // TODO: Implement this...
    // private createOutputFileDiagnosticsForProjectCommand(): VSCodeCommand {
    //     return new VSCodeCommand("kokoabim.csharpen.output-file-diagnostics-for-project", async () => {
    //         if (!await super.isWorkspaceReady()) { return; }

    //         const textDocument = await this.getTextDocument();
    //         if (!textDocument) { return; }

    //         const cSharpProjectFiles = await CSharpProjectFile.findProjects(this.workspaceFolder!.uri.path);
    //         if (cSharpProjectFiles.length === 0) {
    //             await this.information("No C# project found.");
    //             return;
    //         }

    //         const cSharpProjectFile = cSharpProjectFiles.find(p => textDocument.uri.path.includes(p.directory + "/"));
    //         if (!cSharpProjectFile) {
    //             await this.information("No C# project found.");
    //             return;
    //         }

    //         const cSharpFiles = (await vscode.workspace.findFiles("**/*.cs")).filter(f => f.path.includes(cSharpProjectFile.directory + "/"));
    //         if (cSharpFiles.length === 0) {
    //             await this.information(`${cSharpProjectFile.name}: No C# files found.`);
    //             return;
    //         }

    //         const fileDiagnosticsForProject = cSharpFiles.map(f => CSharpFile.getFileDiagnosticsUsingUri(f)).filter(d => d.length > 0);

    //         if (fileDiagnosticsForProject.length === 0) {
    //             await this.information(`${cSharpProjectFile.name}: No diagnostics found.`);
    //             return;
    //         }

    //         this.clearOutput();

    //         fileDiagnosticsForProject.forEach(fileDiagnostics => {
    //             this.outputFileDiagnostics(fileDiagnostics);
    //         });
    //     });
    // }

    private createRemoveUnusedUsingsCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.remove-unused-usings", async () => {
            if (!super.isWorkspaceReady()) { return; }

            const [textEditor, textDocument] = await this.getTextEditorAndTextDocument();
            if (!textDocument || !textEditor) { return; }

            if (await CSharpFile.removeUnusedUsings(textEditor, textDocument)) await this.information("Removed unused using directives.");
        });
    }

    private createSharpenFileCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.sharpen-file", async () => {
            if (!await super.isWorkspaceReady()) { return; }

            const [textEditor, textDocument] = await this.getTextEditorAndTextDocument();
            if (!textEditor || !textDocument) { return; }

            const fileDiagnostics = CSharpFile.getFileDiagnosticsUsingTextDocument(textDocument);
            const fileDiagErrors = fileDiagnostics.filter(d => d.severity === FileDiagnosticSeverity.Error);
            if (fileDiagErrors.length > 0) {
                this.warning("File contains errors. Fix and try again.");
                this.outputFileDiagnostics(fileDiagErrors);
                return;
            }

            const settings = CSharpenVSCodeExtensionSettings.shared(true);
            const documentText = textDocument.getText();

            const [fileFilterStatus, fileFilterReason] = FileFilter.checkAll(vscode.workspace.asRelativePath(textDocument.uri), documentText, settings.fileFilters);
            if (fileFilterStatus === FileFilterStatus.deny) {
                this.warning(fileFilterReason!);
                return;
            }
            else if (fileFilterStatus === FileFilterStatus.confirm) {
                const result = await vscode.window.showWarningMessage(`${fileFilterReason} — Override and continue? (Changes can be undone)`, "Continue", "Cancel");
                if (result !== "Continue") return;
            }

            if (settings.removeUnusedUsingsOnSharpen) await CSharpFile.removeUnusedUsings(textEditor, textDocument);
            if (settings.formatDocumentOnSharpen) await vscode.commands.executeCommand('editor.action.formatDocument', textDocument.uri);

            let csharpFile;
            try {
                csharpFile = await CSharpFile.create(textDocument);
                if (!csharpFile.hasChildren) {
                    this.warning("No C# symbols found.");
                    return;
                }
            }
            catch (e: any) {
                this.error(e.message);
                return;
            }

            try {
                CSharpOrganizer.organizeFile(settings, csharpFile);
            }
            catch (e: any) {
                this.error(e.message);
                return;
            }

            await textEditor.edit(tee => {
                tee.replace(new vscode.Range(CSharpFile.zeroPosition, textDocument.positionAt(textDocument.getText().length)), csharpFile.text);
            });

            if (settings.formatDocumentOnSharpen) await vscode.commands.executeCommand('editor.action.formatDocument', textDocument.uri);

            let fileSizeDiffText = "";
            if (settings.showFileSizeDifferenceOnSharpen) {
                const fileSizeBefore = documentText.length;
                const fileSizeAfter = textDocument.getText().length;
                const fileSizeDiff = fileSizeAfter - fileSizeBefore;
                fileSizeDiffText = ` (${fileSizeDiff > 0 ? `+${fileSizeDiff}` : fileSizeDiff.toString()} size difference)`;
            }

            this.information(`Sharpened.${fileSizeDiffText}`);
        });
    }

    private filterCodeActions(documentSymbolCodeActions: DocumentSymbolCodeActions, filters: string[]): void {
        documentSymbolCodeActions.codeActions = documentSymbolCodeActions.codeActions.filter(ca => !filters.some(f => ca.title.match(f) !== null));
        documentSymbolCodeActions.children.forEach(c => this.filterCodeActions(c, filters));
    }

    private async getDocumentSymbolCodeActions(textDocument: vscode.TextDocument, documentSymbol: vscode.DocumentSymbol): Promise<DocumentSymbolCodeActions> {
        const documentSymbolCodeActions = new DocumentSymbolCodeActions(documentSymbol, await vscode.commands.executeCommand<vscode.CodeAction[]>("vscode.executeCodeActionProvider", textDocument.uri, documentSymbol.range, vscode.CodeActionKind.QuickFix.value) ?? []);
        for (var ds of documentSymbol.children) documentSymbolCodeActions.children.push(await this.getDocumentSymbolCodeActions(textDocument, ds));
        return documentSymbolCodeActions;
    }

    private async getTextDocument(showWarningMessage = true): Promise<vscode.TextDocument | undefined> {
        const textEditor = await this.getTextEditor(showWarningMessage);
        if (!textEditor) return;

        const textDocument = textEditor.document;
        if (!textDocument && showWarningMessage) await this.warning("No document is open.");
        return textDocument;
    }

    private async getTextDocumentCodeActions(textDocument: vscode.TextDocument): Promise<TextDocumentCodeActions | undefined> {
        const documentSymbols = await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", textDocument.uri).then(symbols => symbols as vscode.DocumentSymbol[] || []);
        if (documentSymbols.length === 0) return;

        let textDocumentCodeActions = new TextDocumentCodeActions(textDocument);
        for (var ds of documentSymbols) textDocumentCodeActions.children.push(await this.getDocumentSymbolCodeActions(textDocument, ds));

        const settings = CSharpenVSCodeExtensionSettings.shared(true);
        for (var dsca of textDocumentCodeActions.children) this.filterCodeActions(dsca, settings.quickFixFilters); // dsca.codeActions = dsca.codeActions.filter(ca => !settings.quickFixFilters.some(qff => ca.title.match(qff) !== null));

        return textDocumentCodeActions;
    }

    private async getTextEditor(showWarningMessage = true): Promise<vscode.TextEditor | undefined> {
        const textEditor = vscode.window.activeTextEditor;
        if (!textEditor && showWarningMessage) await this.warning("No editor is open.");
        return textEditor;
    }

    private async getTextEditorAndTextDocument(showWarningMessage = true): Promise<[vscode.TextEditor | undefined, vscode.TextDocument | undefined]> {
        const textEditor = await this.getTextEditor(showWarningMessage);
        if (!textEditor) return [undefined, undefined];

        const textDocument = await this.getTextDocument(showWarningMessage);
        if (!textDocument) return [undefined, undefined];

        return [textEditor, textDocument];
    }

    private outputDocumentSymbolCodeActions(documentSymbolCodeActions: DocumentSymbolCodeActions, indent: string): void {
        if (documentSymbolCodeActions.codeActions.length === 0 && documentSymbolCodeActions.children.length === 0) return;

        this.outputLine(`${indent}${documentSymbolCodeActions.documentSymbol.detail}`);
        for (var ca of documentSymbolCodeActions.codeActions) this.outputLine(`${indent}- ${ca.title}`);
        documentSymbolCodeActions.children.forEach(c => this.outputDocumentSymbolCodeActions(c, indent + "  "));
    }

    private outputFileDiagnostics(fileDiagnostics: FileDiagnostic[]): void {
        if (fileDiagnostics.length === 0) return;

        this.outputLine("", true);
        fileDiagnostics.forEach(fd => this.outputLine(fd.toString()));
    }

    private outputTextDocumentCodeActions(textDocumentCodeActions?: TextDocumentCodeActions): void {
        if (!textDocumentCodeActions?.hasAny) return;

        this.outputLine(`[${FileSystem.fileNameUsingTextDocument(textDocumentCodeActions.textDocument)}] Quick Fixes:`, true);
        for (var dsca of textDocumentCodeActions.children) {
            if (!dsca.hasAny) continue;

            this.outputLine(`${dsca.documentSymbol.detail} {`);
            for (var ca of dsca.codeActions) this.outputLine(`- ${ca.title}`);
            dsca.children.forEach(c => this.outputDocumentSymbolCodeActions(c, "  "));
            this.outputLine(`}`);
        }
    }
}

class DocumentSymbolCodeActions {
    children: DocumentSymbolCodeActions[] = [];

    constructor(public documentSymbol: vscode.DocumentSymbol, public codeActions: vscode.CodeAction[] = []) { }

    get hasAny(): boolean { return this.codeActions.length > 0 || this.children.some(c => c.hasAny); }
}

class TextDocumentCodeActions {
    constructor(public textDocument: vscode.TextDocument, public children: DocumentSymbolCodeActions[] = []) { }

    get hasAny(): boolean { return this.children.length > 0 && this.children.some(c => c.hasAny); }
}
