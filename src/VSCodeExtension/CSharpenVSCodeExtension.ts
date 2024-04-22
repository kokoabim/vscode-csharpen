import { CSharpenVSCodeExtensionSettings } from "./CSharpenVSCodeExtensionSettings";
import { CSharpFile } from '../CSharp/CSharpFile';
import { CSharpOrganizer } from "../CSharp/CSharpOrganizer";
import { FileDiagnostic, FileDiagnosticSeverity } from "../Models/FileDiagnostic";
import { FileFilter, FileFilterStatus } from "../Models/FileFilter";
import { VSCodeCommand } from "./VSCodeCommand";
import { VSCodeExtension } from "./VSCodeExtension";
import * as vscode from "vscode";

/**
 * CSharpen — C# File Organizer VS Code extension
 */
export class CSharpenVSCodeExtension extends VSCodeExtension {
    //private settings = new CSharpenVSCodeExtensionSettings();

    constructor(context: vscode.ExtensionContext) {
        super(context);

        this.addCommands(
            this.createOutputFileDiagnosticsCommand(),
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

            const fileDiagnostics = CSharpFile.getFileDiagnostics(textDocument);
            if (fileDiagnostics.length === 0) {
                await this.information("No diagnostics found.");
                return;
            }

            this.outputFileDiagnostics(fileDiagnostics);
        });
    }

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

            const fileDiagnostics = CSharpFile.getFileDiagnostics(textDocument);
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

    private async getTextDocument(showWarningMessage = true): Promise<vscode.TextDocument | undefined> {
        const textEditor = await this.getTextEditor(showWarningMessage);
        if (!textEditor) return;

        const textDocument = textEditor.document;
        if (!textDocument && showWarningMessage) await this.warning("No document is open.");
        return textDocument;
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

    private outputFileDiagnostics(fileDiagnostics: FileDiagnostic[]): void {
        this.outputLine("", true);
        fileDiagnostics.forEach(fd => this.outputLine(fd.toString()));
    }
}
