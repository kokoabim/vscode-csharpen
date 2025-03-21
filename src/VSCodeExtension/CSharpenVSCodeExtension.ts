/**
 * CSharpen — C# File Organizer VS Code extension
 * by Spencer James — https://swsj.me
 */
import * as vscode from "vscode";

import { CSharpAccessModifier } from "../CSharp/CSharpAccessModifier";
import { CSharpFile } from "../CSharp/CSharpFile";
import { CSharpOrganizer } from "../CSharp/CSharpOrganizer";
import { CSharpProjectFile } from "../CSharp/CSharpProjectFile";
import { CSharpProjectPackageReference } from "../CSharp/CSharpProjectPackageReference";
import { CSharpSymbol } from "../CSharp/CSharpSymbol";
import { CSharpSymbolType } from "../CSharp/CSharpSymbolType";
import { AppliedCodingStyle } from "../Models/AppliedCodingStyle";
import { DocumentSymbolCodeActions } from "../Models/DocumentSymbolCodeActions";
import { FileDiagnostic, FileDiagnosticSeverity } from "../Models/FileDiagnostic";
import { FileFilter, FileFilterStatus } from "../Models/FileFilter";
import { ObjectResult } from "../Models/MessageResult";
import { RenamedSymbol } from "../Models/RenamedSymbol";
import { TextDocumentCodeActions } from "../Models/TextDocumentCodeActions";
import { FileSystem } from "../Utils/FileSystem";
import { CSharpenVSCodeExtensionSettings } from "./CSharpenVSCodeExtensionSettings";
import { CSharpenWorkspaceSettings } from "./CSharpenWorkspaceSettings";
import { VSCodeCommand } from "./VSCodeCommand";
import { VSCodeExtension } from "./VSCodeExtension";

export class CSharpenVSCodeExtension extends VSCodeExtension {
    constructor(context: vscode.ExtensionContext) {
        super(context);

        this.addCommands(
            this.createApplyCodingStyleToFileCommand(),
            this.createCreateWorkspaceSettingsFileCommand(),
            this.createOutputFileDiagnosticsCommand(),
            this.createOutputFileDiagnosticsForProjectFilesCommand(),
            this.createPerformQuickFixesCommand(),
            this.createRemoveUnusedReferencesCommand(),
            this.createRemoveUnusedUsingsCommand(),
            this.createRenameSymbolsInFileCommand(),
            this.createSharpenFileCommand(),
            this.createSharpenProjectFilesCommand()
        );
    }

    public static use(context: vscode.ExtensionContext): CSharpenVSCodeExtension {
        return new CSharpenVSCodeExtension(context);
    }

    private static filterCodeActions(documentSymbolCodeActions: DocumentSymbolCodeActions, includeFilter: string[], excludeFilter: string[]): void {
        if (includeFilter.length === 0 && excludeFilter.length === 0) return;

        if (includeFilter.length > 0) {
            documentSymbolCodeActions.codeActions = documentSymbolCodeActions.codeActions.filter(ca => includeFilter.some(f => ca.title.match(f) !== null));
        }

        if (excludeFilter.length > 0) {
            documentSymbolCodeActions.codeActions = documentSymbolCodeActions.codeActions.filter(ca => !excludeFilter.some(f => ca.title.match(f) !== null));
        }

        documentSymbolCodeActions.children.forEach(c => this.filterCodeActions(c, includeFilter, excludeFilter));
    }

    private static async getDocumentSymbolQuickFixes(textDocument: vscode.TextDocument, documentSymbol: vscode.DocumentSymbol): Promise<DocumentSymbolCodeActions> {
        const documentSymbolCodeActions = new DocumentSymbolCodeActions(documentSymbol, await vscode.commands.executeCommand("vscode.executeCodeActionProvider", textDocument.uri, documentSymbol.range, vscode.CodeActionKind.QuickFix.value) ?? []);
        for (var ds of documentSymbol.children) documentSymbolCodeActions.children.push(await this.getDocumentSymbolQuickFixes(textDocument, ds));
        return documentSymbolCodeActions;
    }

    private static getFileDiagnosticsUsingTextDocument(document: vscode.TextDocument): FileDiagnostic[] {
        return vscode.languages.getDiagnostics(document.uri).map(d => new FileDiagnostic(FileSystem.fileNameUsingTextDocument(document), d));
    }

    private static async getTextDocumentQuickFixes(textDocument: vscode.TextDocument, includeFilter: string[], excludeFilter: string[]): Promise<TextDocumentCodeActions | undefined> {
        const documentSymbols = await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", textDocument.uri).then(symbols => symbols as vscode.DocumentSymbol[] || []);
        if (documentSymbols.length === 0) return;

        const textDocumentCodeActions = new TextDocumentCodeActions(textDocument);

        for (var ds of documentSymbols) textDocumentCodeActions.children.push(await this.getDocumentSymbolQuickFixes(textDocument, ds));

        for (var dsca of textDocumentCodeActions.children) this.filterCodeActions(dsca, includeFilter, excludeFilter);

        return textDocumentCodeActions;
    }

    private async applyCodingStylesToFile(settings: CSharpenVSCodeExtensionSettings, textEditor: vscode.TextEditor, showMessage: boolean): Promise<ObjectResult<AppliedCodingStyle[]>> {
        if (!settings.codingStyles.anyEnabled) return ObjectResult.ok([], "No Coding Styles enabled.");

        const processFileResult = await settings.codingStyles.processFile(textEditor);

        if (processFileResult.object && processFileResult.object?.length > 0) {
            processFileResult.object.forEach(cs => this.outputLine(cs.text(), true));
        }

        if (showMessage) await this.showMessage(processFileResult);

        return processFileResult;
    }

    private async applySymbolRenaming(settings: CSharpenVSCodeExtensionSettings, textEditor: vscode.TextEditor, symbols: CSharpSymbol[]): Promise<RenamedSymbol | undefined> {
        if (symbols.length === 0) return;

        for await (const symbolRename of settings.symbolRenaming.filter(sr => !sr.disabled)) {
            let newSymbolName: string | undefined;
            for await (const symbol of symbols) {
                if (newSymbolName = symbolRename.process(symbol)) {
                    if (symbols.some(s => s !== symbol && s.name === newSymbolName && s.parent === symbol.parent)) {
                        // this.outputLine(`${symbolRename.name}: '${symbol.memberName}' cannot be renamed to '${newSymbolName}' because a sibling symbol with that name already exists`, true);
                        continue;
                    }

                    const workspaceEdit = await vscode.commands.executeCommand("vscode.executeDocumentRenameProvider", textEditor.document.uri, symbol.nameRange?.start, newSymbolName) as vscode.WorkspaceEdit | undefined;
                    if (workspaceEdit) {
                        if (await vscode.workspace.applyEdit(workspaceEdit)) {
                            this.outputLine(`[SymbolRename: ${symbolRename.name}] ${symbol.memberName} (${CSharpAccessModifier.toString(symbol.accessModifier)} ${CSharpSymbolType.toString(symbol.type)}): name: ${symbol.name} -> ${newSymbolName}`, true);
                            return new RenamedSymbol(symbolRename.name, symbol.name, newSymbolName!, symbol.memberName);
                        }
                        else {
                            this.outputLine(`[SymbolRename: ${symbolRename.name}] ${symbol.memberName} (${CSharpAccessModifier.toString(symbol.accessModifier)} ${CSharpSymbolType.toString(symbol.type)}) cannot be renamed: rename provider did not apply the edit`, true);
                        }
                    }
                    else {
                        this.outputLine(`[SymbolRename: ${symbolRename.name}] ${symbol.memberName} (${CSharpAccessModifier.toString(symbol.accessModifier)} ${CSharpSymbolType.toString(symbol.type)}) cannot be renamed: rename provider did not return a workspace edit`, true);
                    }
                }

                if (symbol.hasChildren) {
                    const renamedSymbol = await this.applySymbolRenaming(settings, textEditor, symbol.children);
                    if (renamedSymbol) return renamedSymbol;
                }
            }
        }

        return;
    }

    private createApplyCodingStyleToFileCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.apply-coding-styles-to-file", async () => {
            if (!super.isWorkspaceReady()) return;

            const textEditor = await this.getTextEditor();
            if (!textEditor) return;

            const settings = CSharpenVSCodeExtensionSettings.shared(true);
            if (!settings.codingStyles.anyEnabled) {
                await this.information("No Coding Styles enabled.");
                return;
            }

            try {
                await this.applyCodingStylesToFile(settings, textEditor, true);
            }
            catch (e: any) {
                await this.error(`Error applying Coding Styles: ${e.message}`);
            }
        });
    }

    private createCreateWorkspaceSettingsFileCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.create-workspace-settings-file", async () => {
            if (!this.isWorkspaceReady()) return;

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceFolder) return;

            const workspaceSettingsFile = workspaceFolder + "/" + CSharpenWorkspaceSettings.fileName;

            const response = await vscode.window.showInformationMessage('Create CSharpen workspace settings file?', {
                modal: true,
                detail: "This will create a .csharpen.json file in the workspace folder.",
            }, "Yes, Current Settings", "Yes, Defaults", "Yes, Empty", "No");

            if (!response || !response.startsWith("Yes")) return;

            const shouldNotWriteFile = await FileSystem.existsAsync(workspaceSettingsFile).then(async exists => {
                if (!exists) return false;

                const answer = await vscode.window.showErrorMessage('The CSharpen workspace settings file already exists. Do you want to overwrite it?', {
                    modal: true,
                }, 'Yes', 'No');

                return answer !== 'Yes';
            });

            if (shouldNotWriteFile) return;

            const workSpaceSettings = response.includes("Empty")
                ? {} as CSharpenWorkspaceSettings
                : CSharpenVSCodeExtensionSettings.createWorkspaceSettingsFromExtensionSettings(response.includes("Defaults"));

            await FileSystem.writeFileAsync(workspaceSettingsFile, workSpaceSettings, true, false);

            await vscode.workspace.openTextDocument(workspaceSettingsFile).then(doc => vscode.window.showTextDocument(doc, { preview: false }));
        });
    }

    private createOutputFileDiagnosticsCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.output-file-diagnostics", async () => {
            if (!await super.isWorkspaceReady()) { return; }

            const textDocument = await this.getTextDocument();
            if (!textDocument) return;

            this.clearOutput();
            this.showOutput();
            const settings = CSharpenVSCodeExtensionSettings.shared(true);

            await this.outputDiagnosticsAndCodeActions(settings, textDocument, true);
        });
    }

    private createOutputFileDiagnosticsForProjectFilesCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.output-file-diagnostics-for-project-files", async () => {
            if (!await super.isWorkspaceReady()) { return; }

            let projects = (await CSharpProjectFile.findProjectsAsync(this.workspaceFolder!)).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
            if (projects.length === 0) {
                await this.information("No C# project found.");
                return;
            }

            if (projects.length > 1) {
                const quickPicked = await vscode.window.showQuickPick(
                    projects.map(p => p.relativePath),
                    { placeHolder: "Select C# projects to output File Diagnostics and Quick Fixes", canPickMany: true });

                if (!quickPicked) return;

                projects = projects.filter(p => quickPicked.includes(p.relativePath));
            }

            const workspaceFiles = await vscode.workspace.findFiles("**/*.cs");

            const settings = CSharpenVSCodeExtensionSettings.shared(true);

            this.clearOutput();
            this.showOutput();

            for await (const project of projects) {
                const fileUris = workspaceFiles.filter(f => f.path.includes(project.directory + "/")).sort((a, b) => a.path.localeCompare(b.path));
                if (fileUris.length === 0) continue;

                this.outputLine(`\n[Project: ${project.name}]`);

                this.outputLine(`Opening ${fileUris.length} C# files...`);

                for await (const f of fileUris) {
                    const textDocument = await vscode.workspace.openTextDocument(f);
                    await vscode.window.showTextDocument(textDocument, { preview: false });
                }

                this.outputLine(`Outputting File Diagnostics and Quick Fixes for ${fileUris.length} C# files...`);

                for await (const f of fileUris) {
                    const textEditor = await vscode.window.showTextDocument(f, { preview: false });

                    await new Promise(f => setTimeout(f, settings.delayBeforeDetectingFileDiagnostics));

                    await this.outputDiagnosticsAndCodeActions(settings, textEditor.document, false);
                }

                this.outputLine(`\nDone outputting File Diagnostics and Quick Fixes for project files.`);
            }

            if (projects.length > 1) this.outputLine("\nDone outputting File Diagnostics and Quick Fixes for all projects.");
        });
    }

    private createPerformQuickFixesCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.perform-quick-fixes", async (showMessage = true) => {
            if (!await super.isWorkspaceReady()) { return; }

            const textDocument = await this.getTextDocument();
            if (!textDocument) return;

            const settings = CSharpenVSCodeExtensionSettings.shared(true);
            let isFirstLoop = true;

            do {
                const textDocumentCodeActions = await CSharpenVSCodeExtension.getTextDocumentQuickFixes(textDocument, settings.quickFixesToPerform, []);
                if (!textDocumentCodeActions?.hasAny) {
                    if (isFirstLoop) {
                        if (showMessage) await this.information("No Quick Fixes found.");
                        return;
                    }
                    else {
                        break;
                    }
                }

                const codeActions = textDocumentCodeActions.children.flatMap(dsca => dsca.codeActions).filter(ca => ca.command !== undefined);
                if (codeActions.length === 0) {
                    if (isFirstLoop) {
                        if (showMessage) await this.information("No Quick Fixes found.");
                        return;
                    }
                    else {
                        break;
                    }
                }

                if (isFirstLoop) {
                    this.clearOutput();
                    this.showOutput();
                }

                this.outputLine(`[Quick Fixes: ${codeActions.length}]`);

                isFirstLoop = false;

                for await (const qf of codeActions) {
                    this.outputLine(qf.title);

                    if (qf.edit) {
                        this.outputLine(` Error: WorkspaceEdit with ${qf.edit.entries().length} entries. Not supported yet.`);
                        continue;
                    }

                    if (qf.command!.arguments?.length !== 1) {
                        this.outputLine(` Error: Command arguments length is not 1.`);
                        continue;
                    }

                    const commandArguments = qf.command!.arguments[0];
                    commandArguments.FixAllFlavors = ['Document'];

                    try {
                        await vscode.commands.executeCommand(qf.command!.command, commandArguments);
                    }
                    catch (e: any) {
                        this.outputLine(` Error: ${e.message}`);
                    }

                    break; // since the document has been modified, restart the do-while loop
                }
            }
            while (true);

            this.outputLine("No more Quick Fixes found.");
        });
    }

    private createRemoveUnusedReferencesCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.remove-unused-references", async () => {
            if (!await super.isWorkspaceReady()) { return; }

            let projects = (await CSharpProjectFile.findProjectsAsync(this.workspaceFolder!)).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
            if (projects.length === 0) {
                await this.information("No C# project found.");
                return;
            }

            if (projects.length > 1) {
                const quickPicked = await vscode.window.showQuickPick(
                    projects.map(p => p.relativePath),
                    { placeHolder: "Select C# projects to remove unused using directives and unused package references", canPickMany: true });

                if (!quickPicked) return;

                projects = projects.filter(p => quickPicked.includes(p.relativePath));
            }

            const settings = CSharpenVSCodeExtensionSettings.shared(true);

            const thirdOperation = settings.sharpenFilesWhenRemovingUnusedReferences
                ? ", and (3) sharpen all opened C# files"
                : "";

            if ("Yes" !== (await vscode.window.showInformationMessage(
                `Remove unused references in ${projects.length === 1 ? "project" : `${projects.length} projects`}?`,
                {
                    modal: true,
                    detail: `This will (1) open all C# files in ${projects.length === 1 ? `project ${projects[0].name}` : `${projects.length} projects`} and remove unused using directives, and (2) remove package references one at a time and ensure the solution builds (if the build fails the package reference is re-added)${thirdOperation}.\n\nThis process can take a few minutes depending on the number of projects, files and references.\n\nIts process can be canceled and modifications can be undone.`,
                },
                "Yes", "No"))) return;

            await this.removeUnusedReferences(projects, settings);
        });
    }

    private createRemoveUnusedUsingsCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.remove-unused-usings", async () => {
            if (!super.isWorkspaceReady()) return;

            const textEditor = await this.getTextEditor();
            if (!textEditor) return;

            const fileDiagnostics = CSharpenVSCodeExtension.getFileDiagnosticsUsingTextDocument(textEditor.document);
            const removedCount = await CSharpFile.removeUnusedUsings(textEditor, fileDiagnostics);

            if (removedCount) await this.information(`Removed ${removedCount} unused using directives.`);
            else await this.information("No unused using directives found.");
        });
    }

    private createRenameSymbolsInFileCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.rename-symbols-in-file", async () => {
            if (!super.isWorkspaceReady()) return;

            const textEditor = await this.getTextEditor();
            if (!textEditor) return;

            const settings = CSharpenVSCodeExtensionSettings.shared(true);
            const symbolRenaming = settings.symbolRenaming.filter(sr => !sr.disabled);
            if (symbolRenaming.length === 0) {
                await this.information("No Symbol Renaming rules found.");
                return;
            }

            let csharpFile;
            let repeat = false;
            const renamedSymbols: RenamedSymbol[] = [];

            do {
                repeat = false;

                try {
                    csharpFile = await CSharpFile.create(textEditor.document);
                    if (!csharpFile.hasChildren) {
                        await this.warning("No C# symbols found.");
                        return;
                    }
                }
                catch (e: any) {
                    await this.error(e.message);
                    return;
                }

                try {
                    const renamedSymbol = await this.applySymbolRenaming(settings, textEditor, csharpFile.children);
                    if (renamedSymbol) {
                        renamedSymbols.push(renamedSymbol);
                        repeat = true;
                    }
                }
                catch (e: any) {
                    await this.warning(`Error applying Symbol Renaming: ${e.message}`);
                }
            } while (repeat);

            if (renamedSymbols.length > 0) await this.information(`Renamed ${renamedSymbols.length} symbol${renamedSymbols.length > 1 ? "s" : ""}.`);
            else await this.information("No symbols renamed.");
        });
    }

    private createSharpenFileCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.sharpen-file", async () => {
            if (!await super.isWorkspaceReady()) { return; }

            const textEditor = await this.getTextEditor();
            if (!textEditor) return;

            const settings = CSharpenVSCodeExtensionSettings.shared(true);

            const fileDiagnostics = CSharpenVSCodeExtension.getFileDiagnosticsUsingTextDocument(textEditor.document);
            const fileDiagErrors = fileDiagnostics.filter(d => d.severity === FileDiagnosticSeverity.Error);
            if (fileDiagErrors.length > 0) {
                this.outputFileDiagnostics(fileDiagErrors);

                if (!settings.allowSharpenWithFileDiagnosticErrors) {
                    const result = await vscode.window.showWarningMessage("File contains diagnostic errors. Continue sharpening?",
                        {
                            modal: true,
                            detail: "Sharpening may not work as expected with File Diagnostic errors. If 'Always' is selected, this warning will not be shown again and can be re-enabled in settings.",
                        },
                        "Once", "Always");

                    if (!result) {
                        return;
                    } else if (result === "Always") {
                        settings.allowSharpenWithFileDiagnosticErrors = true;
                        await settings.set("allowSharpenWithFileDiagnosticErrors", true, vscode.ConfigurationTarget.Global);
                    }
                }
                else {
                    await vscode.window.showWarningMessage("File contains File Diagnostic errors though sharpening is allowed. This can be adjusted in settings.");
                }
            }

            const documentText = textEditor.document.getText();

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [sharpened, removedUnusedUsingsCount, symbolsRenamed, didError, sharpenError] = await this.sharpenFile(settings, textEditor, documentText);
            if (!sharpened || didError) return;

            let infoText = "";
            if (settings.showFileSizeDifferenceOnSharpen) {
                const fileSizeBefore = documentText.length;
                const fileSizeAfter = textEditor.document.getText().length;
                const fileSizeDiff = fileSizeAfter - fileSizeBefore;
                if (fileSizeDiff !== 0) infoText = ` ${fileSizeDiff > 0 ? `+${fileSizeDiff}` : fileSizeDiff.toString()} size difference`;
            }

            if (symbolsRenamed.length > 0) {
                infoText += `${infoText ? "," : ""} ${symbolsRenamed.length} symbol${symbolsRenamed.length !== 1 ? "s" : ""} renamed`;
            }

            if (removedUnusedUsingsCount > 0) {
                infoText += `${infoText ? "," : ""} ${removedUnusedUsingsCount} unused using${removedUnusedUsingsCount !== 1 ? "s" : ""} removed`;
            }

            infoText = infoText ? infoText.trim() : "Sharpened.";

            await this.information(`${infoText}`, true);
        });
    }

    private createSharpenProjectFilesCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.sharpen-project-files", async () => {
            if (!await super.isWorkspaceReady()) { return; }

            let projects = (await CSharpProjectFile.findProjectsAsync(this.workspaceFolder!)).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
            if (projects.length === 0) {
                await this.information("No C# project found.");
                return;
            }

            if (projects.length > 1) {
                const quickPicked = await vscode.window.showQuickPick(
                    projects.map(p => p.relativePath),
                    { placeHolder: "Select C# projects to sharpen files", canPickMany: true });

                if (!quickPicked) return;

                projects = projects.filter(p => quickPicked.includes(p.relativePath));
            }

            const workspaceFiles = await vscode.workspace.findFiles("**/*.cs");

            if ("Yes" !== (await vscode.window.showInformationMessage(
                `Sharpen all C# files in ${projects.length === 1 ? "project" : `${projects.length} projects`}?`,
                {
                    modal: true,
                    detail: `This will open and sharpen all C# files in ${projects.length === 1 ? `project ${projects[0].name}` : `${projects.length} projects`}.\n\nModifications can be undone.`,
                },
                "Yes", "No"))) return;

            const settings = CSharpenVSCodeExtensionSettings.shared(true);

            this.clearOutput();
            this.showOutput();

            for await (const project of projects) {
                const fileUris = workspaceFiles.filter(f => f.path.includes(project.directory + "/")).sort((a, b) => a.path.localeCompare(b.path));
                if (fileUris.length === 0) continue;

                for await (const fileUri of fileUris) {
                    const textDocument = await vscode.workspace.openTextDocument(fileUri);
                    await vscode.window.showTextDocument(textDocument, { preview: false });
                    await new Promise(f => setTimeout(f, settings.delayBeforeSharpeningFile));
                    await vscode.commands.executeCommand("kokoabim.csharpen.sharpen-file");
                }
            }
        });
    }

    private async outputDiagnosticsAndCodeActions(settings: CSharpenVSCodeExtensionSettings, textDocument: vscode.TextDocument, showMessage: boolean): Promise<void> {
        const fileDiagnostics = CSharpenVSCodeExtension.getFileDiagnosticsUsingTextDocument(textDocument);
        const quickFixes = await CSharpenVSCodeExtension.getTextDocumentQuickFixes(textDocument, [], settings.quickFixFilters);

        if (fileDiagnostics.length === 0 && quickFixes?.hasAny !== true) {
            if (showMessage) await this.information("No File Diagnostics or Quick Fixes.");
            return;
        }

        this.outputLine(`\n[${FileSystem.fileNameUsingTextDocument(textDocument)}]`, true);

        if (fileDiagnostics.length > 0) {
            this.outputLine(`[File Diagnostics: ${fileDiagnostics.length}]`);
            this.outputFileDiagnostics(fileDiagnostics);
        }

        if (quickFixes?.hasAny) {
            this.outputLine(`[Quick Fixes: ${quickFixes.count}]`);
            this.outputFileCodeActions(quickFixes);
        }
    }

    private outputDocumentSymbolCodeActions(parentSymbolDetail: string, documentSymbolCodeActions: DocumentSymbolCodeActions): void {
        if (documentSymbolCodeActions.codeActions.length === 0 && documentSymbolCodeActions.children.length === 0) return;

        const symbolDetail = `${parentSymbolDetail}.${documentSymbolCodeActions.documentSymbol.detail}`;

        if (documentSymbolCodeActions.codeActions.length > 0) {
            this.outputLine(`${symbolDetail}: ${documentSymbolCodeActions.codeActions.map(ca => ca.title).join(", ")}`);
        }

        if (documentSymbolCodeActions.children.length > 0) {
            documentSymbolCodeActions.children.forEach(c => this.outputDocumentSymbolCodeActions(symbolDetail, c));
        }
    }

    private outputFileCodeActions(textDocumentCodeActions?: TextDocumentCodeActions): void {
        if (!textDocumentCodeActions?.hasAny) return;

        for (var dsca of textDocumentCodeActions.children) {
            if (!dsca.hasAny) continue;

            if (dsca.codeActions.length > 0) {
                this.outputLine(`${dsca.documentSymbol.detail}: ${dsca.codeActions.map(ca => ca.title).join(", ")}`);
            }

            if (dsca.children.length > 0) {
                dsca.children.forEach(c => this.outputDocumentSymbolCodeActions(dsca.documentSymbol.detail, c));
            }
        }
    }

    private outputFileDiagnostics(fileDiagnostics: FileDiagnostic[]): void {
        if (fileDiagnostics.length === 0) return;
        fileDiagnostics.forEach(fd => this.outputLine(fd.toString()));
    }

    private async removeUnusedReferences(projects: CSharpProjectFile[], settings: CSharpenVSCodeExtensionSettings): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${settings.sharpenFilesWhenRemovingUnusedReferences ? "Sharpening files, removing" : "Removing"} unused using directives and ${settings.sharpenFilesWhenRemovingUnusedReferences ? "removing unused " : ""}package references`,
            cancellable: true
        }, async (process, token) => {
            process.report({ message: "Finding C# files..." });

            if (settings.sharpenFilesWhenRemovingUnusedReferences) settings.removeUnusedUsingsOnSharpen = true;

            const workspaceFiles = await vscode.workspace.findFiles("**/*.cs");
            const projectFiles: { [key: string]: vscode.Uri[] }[] = projects.map(p =>
                ({ [p.filePath]: workspaceFiles.filter(f => f.path.includes(p.directory + "/")).sort((a, b) => a.path.localeCompare(b.path)) }));

            const packageReferencesTotalCount = projects.flatMap(p => p.packageReferences).length;
            const packageReferenceProcessedIncrementSize = packageReferencesTotalCount > 0 ? 100 / packageReferencesTotalCount : 0;

            let projectFilesTotalCount = 0;
            let removedPackageReferencesTotalCount = 0;
            // ? TODO: see below TODO: let removedProjectReferencesTotalCount = 0;
            let removedUnusedUsingsTotalCount = 0;
            let abortingOrDidCancel = false;

            this.clearOutput();
            this.showOutput();

            const reportProgress = (message: string, incrementPackageReferenceProcessed = false): void => {
                process.report({ message: message, increment: incrementPackageReferenceProcessed ? packageReferenceProcessedIncrementSize : undefined });
            };

            const askToContinueOnWarning = async (warningMessage: string, callbackOnContinue?: () => Promise<boolean>): Promise<boolean> => {
                const response = (await vscode.window.showWarningMessage(warningMessage, {}, "Continue", "Abort"));
                if (response === "Continue") {
                    if (callbackOnContinue) {
                        const shouldContinue = await callbackOnContinue();
                        if (!shouldContinue) return false;
                    }

                    return true;
                }
                else {
                    this.outputLine(`\nAborting 🚫`);
                    abortingOrDidCancel = true;
                    return false;
                }
            };

            const isCancellationRequested = (): boolean => {
                if (token.isCancellationRequested) {
                    this.outputLine(`\nCancelled 🚫`);
                    abortingOrDidCancel = true;
                    return true;
                }
                else return false;
            };

            const isAutoGeneratedFileAndContinue = async (textDocument: vscode.TextDocument/*, fileUri: vscode.Uri*/): Promise<boolean> => {
                if (settings.skipAutoGeneratedFileWhenRemovingUnusedReferences && settings.autoGeneratedPatterns.length > 0) {
                    const text = textDocument.getText();
                    if (settings.autoGeneratedPatterns.some(p => new RegExp(p, "gm").exec(text) !== null)) {
                        // this.outputLine(`\n[File: ${vscode.workspace.asRelativePath(fileUri)}] Skipping auto-generated file`);
                        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                        return true;
                    }
                }
                return false;
            };

            const processProjectFiles = async (projectFileUris: vscode.Uri[], removeUnusedUsings: boolean, sharpenFiles: boolean): Promise<[boolean, number]> => {
                let removedUnusedUsingsFromAllFilesCount = 0;

                for await (const fileUri of projectFileUris) {
                    if (isCancellationRequested()) return [false, removedUnusedUsingsFromAllFilesCount];

                    try {
                        const textDocument = await vscode.workspace.openTextDocument(fileUri);

                        if (await isAutoGeneratedFileAndContinue(textDocument)) continue; // fileUri for-loop

                        const textEditor = await vscode.window.showTextDocument(textDocument, { preview: false });

                        await new Promise(f => setTimeout(f, settings.delayBeforeRemovingUnusedUsingDirectives));

                        let removedUnusedUsingsFromFileCount = 0;

                        if (removeUnusedUsings && !sharpenFiles) {
                            const fileDiagnostics = CSharpenVSCodeExtension.getFileDiagnosticsUsingTextDocument(textEditor.document);
                            removedUnusedUsingsFromFileCount = await CSharpFile.removeUnusedUsings(textEditor, fileDiagnostics);
                        }
                        else if (sharpenFiles) {
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            const [sharpened, removedUnusedUsingsCount, symbolsRenamedCount, didError, sharpenError] = await this.sharpenFile(settings, textEditor, textDocument.getText(), true);

                            if (didError) {
                                if (!await askToContinueOnWarning(`Sharpening failed. You may address the failure now then continue.\n\n${sharpenError}`)) {
                                    return [false, removedUnusedUsingsFromAllFilesCount];
                                }
                            }

                            removedUnusedUsingsFromFileCount = removedUnusedUsingsCount;
                        }

                        if (sharpenFiles || removedUnusedUsingsFromFileCount > 0) await textEditor.document.save();

                        removedUnusedUsingsFromAllFilesCount += removedUnusedUsingsFromFileCount;
                    }
                    catch (e: any) {
                        this.outputLine(" Error: " + e.message);

                        if (!await askToContinueOnWarning(`${settings.sharpenFilesWhenRemovingUnusedReferences ? "Sharpening of file and removal" : "Removal"} of unused using directives failed. You may address the failure now then continue.`)) {
                            return [false, removedUnusedUsingsFromAllFilesCount];
                        }
                    }
                }

                return [true, removedUnusedUsingsFromAllFilesCount];
            };

            for await (const project of projects) {
                if (isCancellationRequested()) break; // project for-loop

                reportProgress(`Processing ${project.name}...`);

                const projectFileUris = projectFiles.find(pf => pf[project.filePath])?.[project.filePath] ?? [];
                if (projectFileUris.length > 0) {
                    projectFilesTotalCount += projectFileUris.length;

                    this.output(`\n[Project: ${project.name}] ${settings.sharpenFilesWhenRemovingUnusedReferences ? "Sharpening files and removing" : "Removing"} unused using directives of ${projectFileUris.length} C# files...`);

                    for await (const fileUri of projectFileUris) {
                        if (isCancellationRequested()) break; // fileUri for-loop

                        const textDocument = await vscode.workspace.openTextDocument(fileUri);

                        if (await isAutoGeneratedFileAndContinue(textDocument)) continue; // fileUri for-loop

                        await vscode.window.showTextDocument(textDocument, { preview: false });
                    }

                    if (abortingOrDidCancel) break; // project for-loop

                    this.outputLine(` done`);
                }

                if (projectFileUris.length > 0 || project.packageReferences.length > 0) { // ? TODO: see below TODO: || project.projectReferences.length > 0) {
                    let didBuildSolution = await projects[0].buildSolutionAsync(this.outputChannel, " - ", false);
                    if (!didBuildSolution) {
                        if (!await askToContinueOnWarning(`Solution build failed. You may address the failure now then continue.`, async () => {
                            do {
                                didBuildSolution = await projects[0].buildSolutionAsync(this.outputChannel, " - ", false);
                                if (didBuildSolution) return true;
                            }
                            while (await askToContinueOnWarning(`Solution build failed. You may address the failure now then continue.`));
                            return false;
                        })) break; // project for-loop
                    }

                    if (projectFileUris.length > 0) {
                        this.output(` - ${settings.sharpenFilesWhenRemovingUnusedReferences ? "Sharpening files and removing" : "Removing"} unused using directives...`);

                        const [shouldContinueOn, removedUnusedUsingsFromProjectFilesCount] = await processProjectFiles(projectFileUris, true, settings.sharpenFilesWhenRemovingUnusedReferences);

                        removedUnusedUsingsTotalCount += removedUnusedUsingsFromProjectFilesCount;

                        if (!shouldContinueOn) break; // project for-loop

                        if (removedUnusedUsingsFromProjectFilesCount > 0) this.outputLine(` removed ${removedUnusedUsingsFromProjectFilesCount}`);
                        else this.outputLine(` none found`);
                    }
                }

                if (project.packageReferences.length > 0) {
                    const conditionalPackageReferenceRemovals: { conditionalReference: string, possibleRemoval: CSharpProjectPackageReference }[] = [];

                    for await (const packageReference of project.packageReferences) {
                        if (isCancellationRequested()) break; // packageReference for-loop

                        reportProgress(`Processing ${project.name}: ${packageReference.name}...`);

                        const doNotRemoveConfig = settings.doNotRemoveThesePackageReferences.find(p => {
                            const packageName = p.includes(";") ? p.split(";")[0] : p;
                            return packageReference.name.match(`^${packageName}$`) !== null;
                        });

                        if (doNotRemoveConfig) {
                            let skipThisPackageRemoval = true;

                            if (!doNotRemoveConfig.includes(";")) {
                                this.outputLine(`\n[Project: ${project.name}] Skipping ${packageReference.name} since it is configured not to be removed`);
                            }
                            else {
                                const doNotRemoveConfigSplit = doNotRemoveConfig.split(";");
                                if (doNotRemoveConfigSplit.length !== 2) {
                                    this.outputLine(`\n[Project: ${project.name}] Skipping ${packageReference.name} since its configuration to skip is improper ‼️`);
                                }
                                else {
                                    const possibleRemovalName = doNotRemoveConfigSplit[0];
                                    const conditionalReferenceName = doNotRemoveConfigSplit[1];

                                    const possiblePackagesToRemove = project.packageReferences.filter(pr => pr.name.match(`^${possibleRemovalName}$`) !== null);

                                    if (possiblePackagesToRemove.length === 0) {
                                        skipThisPackageRemoval = false; // "conditionalReference" does not exist so try to remove "packageReference" now
                                    }
                                    else {
                                        possiblePackagesToRemove.forEach(pptr => {
                                            if (!conditionalPackageReferenceRemovals.some(cprr => cprr.possibleRemoval.name === pptr.name)) {
                                                conditionalPackageReferenceRemovals.push({ conditionalReference: conditionalReferenceName, possibleRemoval: pptr });
                                            }
                                        });
                                    }
                                }
                            }

                            if (skipThisPackageRemoval) continue; // packageReference for-loop
                        }

                        await project.removePackageReferenceAsync(this.outputChannel, packageReference);

                        reportProgress(`Processing ${project.name}...`, true);
                    }

                    if (abortingOrDidCancel) break; // project for-loop

                    if (conditionalPackageReferenceRemovals.length > 0) {
                        const packageReferenceRemovals = conditionalPackageReferenceRemovals.filter(cprr => project.packageReferences.filter(pr => pr.name.match(`^${cprr.conditionalReference}$`) !== null).length === 0).map(cprr => cprr.possibleRemoval);

                        if (packageReferenceRemovals.length > 0) {
                            this.outputLine(`\n[Project: ${project.name}] Removing ${packageReferenceRemovals.length} conditional package references...`);

                            for await (const packageReference of packageReferenceRemovals) {
                                if (isCancellationRequested()) break; // packageReference for-loop

                                await project.removePackageReferenceAsync(this.outputChannel, packageReference);
                            }

                            if (abortingOrDidCancel) break; // project for-loop
                        }
                    }

                    if (project.removedPackageReferences.length > 0) {
                        removedPackageReferencesTotalCount += project.removedPackageReferences.length;

                        this.outputLine(`\n[Project: ${project.name}] Removed ${project.removedPackageReferences.length} package references:`);
                        project.removedPackageReferences.forEach(r => this.outputLine(` - ${r.name}`));
                    }
                }

                // ? TODO: resolve issue with removing project references
                /*if (project.projectReferences.length > 0) {
                    for await (const projectReference of project.projectReferences) {
                        await project.removeProjectReferenceAsync(this.outputChannel, projectReference);
                    }

                    if (project.removedProjectReferences.length > 0) {
                        removedProjectReferencesTotalCount += project.removedProjectReferences.length;

                        this.outputLine(`\n[Project: ${project.name}] Removed ${project.removedProjectReferences.length} project references:`);
                        project.removedProjectReferences.forEach(r => this.outputLine(` - ${r.name}`));
                    }
                }*/

                if (project.removedPackageReferences.length > 0) { // ? TODO: see above TODO: || project.removedProjectReferences.length > 0) {
                    if (projectFileUris.length > 0) {
                        this.outputLine(`\n[Project: ${project.name}] Since package references were removed, repeating to ${settings.sharpenFilesWhenRemovingUnusedReferences ? "sharpen files and " : ""}remove unused using directives for ${projectFileUris.length} C# files...`);

                        let didBuildSolution = await project.buildSolutionAsync(this.outputChannel, " - ", false);
                        if (!didBuildSolution) {
                            if (!await askToContinueOnWarning(`Solution build failed. You may address the failure now then continue.`, async () => {
                                do {
                                    didBuildSolution = await project.buildSolutionAsync(this.outputChannel, " - ", false);
                                    if (didBuildSolution) return true;
                                }
                                while (await askToContinueOnWarning(`Solution build failed. You may address the failure now then continue.`));
                                return false;
                            })) break; // project for-loop
                        }

                        const [shouldContinueOn, removedUnusedUsingsFromProjectFilesCount] = await processProjectFiles(projectFileUris, true, settings.sharpenFilesWhenRemovingUnusedReferences);

                        removedUnusedUsingsTotalCount += removedUnusedUsingsFromProjectFilesCount;

                        if (!shouldContinueOn) break; // project for-loop

                        if (removedUnusedUsingsFromProjectFilesCount > 0) this.outputLine(` - Removed ${removedUnusedUsingsFromProjectFilesCount} unused using directives`);
                        else this.outputLine(` - None found`);
                    }
                }
            }

            reportProgress(`Finishing...`);

            if (removedPackageReferencesTotalCount + removedUnusedUsingsTotalCount > 0) {
                this.outputLine(`\n${"=".repeat(50)}`);

                if (!abortingOrDidCancel) {
                    this.outputLine("");

                    const didBuildSolution = await projects[0].buildSolutionAsync(this.outputChannel, undefined, true);
                    if (!didBuildSolution) {
                        this.outputLine(`\nBuild failed but don't worry. This is most likely due to a used using directive that was removed. The VS Code API at times incorrectly indicates that a using directive is not used so thus it is removed. All files are still open and can be modified.`);
                    }

                    this.outputLine(`\n${"-".repeat(50)}`);
                }

                if (removedPackageReferencesTotalCount > 0) {
                    this.outputLine(`\nRemoved ${removedPackageReferencesTotalCount} package references throughout ${projects.length} projects:`);
                    projects.filter(p => p.removedPackageReferences.length > 0).flatMap(p => ` - ${p.name} (${p.removedPackageReferences.length}):\n   - ${p.removedPackageReferences.flatMap(rp => rp.name).join("\n   - ")}`).forEach(p => this.outputLine(p));
                }

                // ? TODO: see above TODO
                // if (removedProjectReferencesTotalCount > 0) {
                //     this.outputLine(`\nRemoved ${removedProjectReferencesTotalCount} project references from ${projects.length} projects:`);
                //     projects.flatMap(p => ` - ${p.name} (${p.removedProjectReferences.length}):\n   - ${p.removedProjectReferences.flatMap(rp => rp.name).join("\n   - ")}`).forEach(p => this.outputLine(p));
                // }

                if (removedUnusedUsingsTotalCount > 0) {
                    this.outputLine(`\n${"-".repeat(50)}`);
                    this.outputLine(`\nRemoved ${removedUnusedUsingsTotalCount} unused using directives throughout ${projectFilesTotalCount} files`);
                }

                this.outputLine(`\n${"=".repeat(50)}`);
            }

            this.outputLine(`\n🏁 Finished ${settings.sharpenFilesWhenRemovingUnusedReferences ? "sharpening files and" : ""}removing unused using directives and ${settings.sharpenFilesWhenRemovingUnusedReferences ? "removing unused " : ""}package references 🏁`);

            if (!settings.sharpenFilesWhenRemovingUnusedReferences) {
                this.outputLine(`\n💡 Tip: Set extension setting 'csharpen.sharpenFilesWhenRemovingUnusedReferences' to 'true' to sharpen all opened C# files during this process`);
            }
        });
    }

    private async sharpenFile(settings: CSharpenVSCodeExtensionSettings, textEditor: vscode.TextEditor, documentText: string, batchProcessing = false):
        Promise<[sharpened: boolean, removedUnusedUsingsCount: number, renamedSymbols: RenamedSymbol[], didError: boolean, sharpenError: string | undefined]> {
        const [fileFilterStatus, fileFilterReason] = FileFilter.checkAll(vscode.workspace.asRelativePath(textEditor.document.uri), documentText, settings.fileFilters);
        if (fileFilterStatus === FileFilterStatus.deny) {
            if (!batchProcessing) await this.warning(fileFilterReason!);
            return [false, 0, [], false, fileFilterReason];
        }
        else if (fileFilterStatus === FileFilterStatus.confirm) {
            const result = await vscode.window.showWarningMessage(`${fileFilterReason} — Override and continue? (Changes can be undone)`, "Continue", "Cancel");
            if (result !== "Continue") return [false, 0, [], false, `Canceled: ${fileFilterReason}`];
        }

        // --- remove unused usings ---

        let removedUnusedUsingsCount = 0;
        if (settings.removeUnusedUsingsOnSharpen) {
            const fileDiagnostics = CSharpenVSCodeExtension.getFileDiagnosticsUsingTextDocument(textEditor.document);
            removedUnusedUsingsCount = settings.removeUnusedUsingsOnSharpen ? await CSharpFile.removeUnusedUsings(textEditor, fileDiagnostics) : 0;
        }

        // --- coding styles ---

        if (!batchProcessing && settings.codingStylesEnabled && settings.codingStyles.anyEnabled) await this.applyCodingStylesToFile(settings, textEditor, false);

        // --- quick fixes ---

        if (!batchProcessing && settings.performQuickFixesOnSharpen) await vscode.commands.executeCommand('kokoabim.csharpen.perform-quick-fixes', false);

        // --- sharpen ---

        if (settings.formatDocumentOnSharpen) await vscode.commands.executeCommand('editor.action.formatDocument', textEditor.document.uri);

        let csharpFile: CSharpFile;

        try {
            csharpFile = await CSharpFile.create(textEditor.document);
            if (!csharpFile.hasChildren) {
                if (!batchProcessing) await this.warning("No C# symbols found.");
                return [false, removedUnusedUsingsCount, [], false, "No C# symbols found"];
            }

            CSharpOrganizer.organizeFile(settings, csharpFile);
        }
        catch (e: any) {
            if (!batchProcessing) await this.error(e.message);
            return [false, removedUnusedUsingsCount, [], true, `Error: ${e.message}`];
        }

        await textEditor.edit(tee => {
            tee.replace(new vscode.Range(CSharpFile.zeroPosition, textEditor.document.positionAt(textEditor.document.getText().length)), csharpFile.text);
        });

        if (settings.formatDocumentOnSharpen) await vscode.commands.executeCommand('editor.action.formatDocument', textEditor.document.uri);

        // --- symbol renaming ---

        let repeatSymbolRenaming = false;
        const renamedSymbols: RenamedSymbol[] = [];

        do {
            repeatSymbolRenaming = false;

            try {
                csharpFile = await CSharpFile.create(textEditor.document);
                if (!csharpFile.hasChildren) {
                    if (!batchProcessing) await this.warning("No C# symbols found.");
                    return [false, removedUnusedUsingsCount, renamedSymbols, false, "No C# symbols found"];
                }
            }
            catch (e: any) {
                if (!batchProcessing) await this.error(e.message);
                return [false, removedUnusedUsingsCount, renamedSymbols, true, `Error: ${e.message}`];
            }

            if (!batchProcessing && settings.symbolRenamingEnabled && settings.symbolRenaming.length > 0) {
                try {
                    const renamedSymbol = await this.applySymbolRenaming(settings, textEditor, csharpFile.children);
                    if (renamedSymbol) {
                        renamedSymbols.push(renamedSymbol);
                        repeatSymbolRenaming = true;
                    }
                }
                catch (e: any) {
                    if (!batchProcessing) await this.warning(`Error renaming symbol: ${e.message}`);
                    // NOTE: do not return on this error, continue to sharpen file
                }
            }

        } while (repeatSymbolRenaming); // NOTE: have to re-create the CSharpFile after each renamed symbol because of the symbol position values changing

        return [true, removedUnusedUsingsCount, renamedSymbols, false, undefined];
    }
}
