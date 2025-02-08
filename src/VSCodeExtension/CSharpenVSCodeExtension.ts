import * as vscode from "vscode";

import { CSharpFile } from "../CSharp/CSharpFile";
import { CSharpOrganizer } from "../CSharp/CSharpOrganizer";
import { CSharpProjectFile, CSharpProjectPackageReference } from "../CSharp/CSharpProjectFile";
import { CSharpSymbol } from "../CSharp/CSharpSymbol";
import { FileDiagnostic, FileDiagnosticSeverity } from "../Models/FileDiagnostic";
import { FileFilter, FileFilterStatus } from "../Models/FileFilter";
import { FileSystem } from "../Utils/FileSystem";
import { CSharpenVSCodeExtensionSettings } from "./CSharpenVSCodeExtensionSettings";
import { CSharpenWorkspaceSettings } from "./CSharpenWorkspaceSettings";
import { VSCodeCommand } from "./VSCodeCommand";
import { VSCodeExtension } from "./VSCodeExtension";

/**
 * CSharpen — C# File Organizer VS Code extension
 */
export class CSharpenVSCodeExtension extends VSCodeExtension {
    constructor(context: vscode.ExtensionContext) {
        super(context);

        this.addCommands(
            this.createOutputFileDiagnosticsCommand(),
            this.createOutputFileDiagnosticsForProjectFilesCommand(),
            this.createRemoveUnusedReferencesCommand(),
            this.createRemoveUnusedUsingsCommand(),
            this.createSharpenFileCommand(),
            this.createSharpenProjectFilesCommand(),
            this.createCreateWorkspaceSettingsFileCommand());
    }

    static use(context: vscode.ExtensionContext): CSharpenVSCodeExtension {
        return new CSharpenVSCodeExtension(context);
    }

    private async applySymbolRenaming(settings: CSharpenVSCodeExtensionSettings, textEditor: vscode.TextEditor, symbols: CSharpSymbol[]): Promise<boolean> {
        if (symbols.length === 0) return false;

        for await (const symbolRename of settings.symbolRenaming.filter(sr => !sr.disabled)) {
            for await (const symbol of symbols) {
                if (symbolRename.match(symbol)) {
                    if (symbols.some(s => s !== symbol && s.name === symbolRename.newSymbolName && s.parent === symbol.parent)) {
                        // this.outputLine(`${symbolRename.name}: '${symbol.memberName}' cannot be renamed to '${symbolRename.newSymbolName}' because a sibling symbol with that name already exists.`, true);
                        continue;
                    }

                    const workspaceEdit = await vscode.commands.executeCommand("vscode.executeDocumentRenameProvider", textEditor.document.uri, symbol.nameRange?.start, symbolRename.newSymbolName) as vscode.WorkspaceEdit | undefined;
                    if (workspaceEdit) {
                        if (await vscode.workspace.applyEdit(workspaceEdit)) {
                            this.outputLine(`${symbolRename.name}: '${symbol.memberName}' renamed to '${symbolRename.newSymbolName}'.`, true);
                            return true;
                        }
                        else {
                            this.outputLine(`${symbolRename.name}: '${symbol.memberName}' cannot be renamed to '${symbolRename.newSymbolName}' because the rename provider did not apply the edit.`, true);
                        }
                    }
                    else {
                        this.outputLine(`${symbolRename.name}: '${symbol.memberName}' cannot be renamed to '${symbolRename.newSymbolName}' because the rename provider did not return a workspace edit.`, true);
                    }
                }

                if (symbol.hasChildren && (await this.applySymbolRenaming(settings, textEditor, symbol.children))) return true;
            }
        }

        return false;
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

            await vscode.workspace.openTextDocument(workspaceSettingsFile).then(doc => vscode.window.showTextDocument(doc));
        });
    }

    private createOutputFileDiagnosticsCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.output-file-diagnostics", async () => {
            if (!await super.isWorkspaceReady()) { return; }

            const textDocument = await this.getTextDocument();
            if (!textDocument) return;

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
                    { placeHolder: "Select C# projects to output file diagnostics", canPickMany: true });

                if (!quickPicked) return;

                projects = projects.filter(p => quickPicked.includes(p.relativePath));
            }

            const workspaceFiles = await vscode.workspace.findFiles("**/*.cs");

            this.clearOutput();
            this.showOutput();

            for await (const project of projects) {
                const fileUris = workspaceFiles.filter(f => f.path.includes(project.directory + "/")).sort((a, b) => a.path.localeCompare(b.path));
                if (fileUris.length === 0) continue;

                this.outputLine(`\n[Project: ${project.name}] Opening and outputting file diagnostics for ${fileUris.length} C# files...`);

                for (const f of fileUris) {
                    const textDocument = await vscode.workspace.openTextDocument(f);
                    // eslint-disable-next-line no-unused-vars
                    const textEditor = await vscode.window.showTextDocument(textDocument);
                }

                // TODO: add delay before detecting file diagnostics

                const fileDiagnosticsForProjectFiles = fileUris.flatMap(f => CSharpFile.getFileDiagnosticsUsingUri(f));
                if (fileDiagnosticsForProjectFiles.length === 0) continue;

                this.outputFileDiagnostics(fileDiagnosticsForProjectFiles);
            }
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

            const removedCount = await CSharpFile.removeUnusedUsings(textEditor);

            if (removedCount) await this.information(`Removed ${removedCount} unused using directives.`);
            else await this.information("No unused using directives found.");
        });
    }

    private createSharpenFileCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.csharpen.sharpen-file", async () => {
            if (!await super.isWorkspaceReady()) { return; }

            const textEditor = await this.getTextEditor();
            if (!textEditor) return;

            const settings = CSharpenVSCodeExtensionSettings.shared(true);

            const fileDiagnostics = CSharpFile.getFileDiagnosticsUsingTextDocument(textEditor.document);
            const fileDiagErrors = fileDiagnostics.filter(d => d.severity === FileDiagnosticSeverity.Error);
            if (fileDiagErrors.length > 0) {
                this.outputFileDiagnostics(fileDiagErrors);

                if (!settings.allowSharpenWithFileDiagnosticErrors) {
                    const result = await vscode.window.showWarningMessage("File contains diagnostic errors. Continue sharpening?",
                        {
                            modal: true,
                            detail: "Sharpening may not work as expected with file diagnostic errors. If 'Always' is selected, this warning will not be shown again and can be re-enabled in settings.",
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
                    await vscode.window.showWarningMessage("File contains diagnostic errors though sharpening is allowed. This can be adjusted in settings.");
                }
            }

            const documentText = textEditor.document.getText();

            // eslint-disable-next-line no-unused-vars
            const [sharpened, removedUnusedUsingsCount, symbolsRenamedCount, didError, sharpenError] = await this.sharpenFile(settings, textEditor, documentText);
            if (!sharpened || didError) return;

            let infoText = "";
            if (settings.showFileSizeDifferenceOnSharpen) {
                const fileSizeBefore = documentText.length;
                const fileSizeAfter = textEditor.document.getText().length;
                const fileSizeDiff = fileSizeAfter - fileSizeBefore;
                if (fileSizeDiff !== 0) infoText = ` ${fileSizeDiff > 0 ? `+${fileSizeDiff}` : fileSizeDiff.toString()} size`;
            }

            if (settings.symbolRenamingEnabled && symbolsRenamedCount > 0) {
                infoText += `${infoText ? "," : ""} ${symbolsRenamedCount} symbol${symbolsRenamedCount > 1 ? "s" : ""} renamed`;
            }

            if (removedUnusedUsingsCount > 0) {
                infoText += `${infoText ? "," : ""} ${removedUnusedUsingsCount} unused using${removedUnusedUsingsCount > 1 ? "s" : ""} removed`;
            }

            infoText = infoText ? infoText.trim() : "Sharpened.";

            this.information(`${infoText}`, true);
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
                    { placeHolder: "Select C# projects to output file diagnostics", canPickMany: true });

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

            this.clearOutput();
            this.showOutput();

            for await (const project of projects) {
                const fileUris = workspaceFiles.filter(f => f.path.includes(project.directory + "/")).sort((a, b) => a.path.localeCompare(b.path));
                if (fileUris.length === 0) continue;

                for await (const fileUri of fileUris) {
                    const textDocument = await vscode.workspace.openTextDocument(fileUri);
                    // eslint-disable-next-line no-unused-vars
                    const textEditor = await vscode.window.showTextDocument(textDocument);
                    await vscode.commands.executeCommand("kokoabim.csharpen.sharpen-file");
                }
            }
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

    private async getTextDocumentCodeActions(textDocument: vscode.TextDocument): Promise<TextDocumentCodeActions | undefined> {
        const documentSymbols = await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", textDocument.uri).then(symbols => symbols as vscode.DocumentSymbol[] || []);
        if (documentSymbols.length === 0) return;

        let textDocumentCodeActions = new TextDocumentCodeActions(textDocument);
        for (var ds of documentSymbols) textDocumentCodeActions.children.push(await this.getDocumentSymbolCodeActions(textDocument, ds));

        const settings = CSharpenVSCodeExtensionSettings.shared(true);
        for (var dsca of textDocumentCodeActions.children) this.filterCodeActions(dsca, settings.quickFixFilters); // dsca.codeActions = dsca.codeActions.filter(ca => !settings.quickFixFilters.some(qff => ca.title.match(qff) !== null));

        return textDocumentCodeActions;
    }

    private outputDocumentSymbolCodeActions(documentSymbolCodeActions: DocumentSymbolCodeActions, indent: string): void {
        if (documentSymbolCodeActions.codeActions.length === 0 && documentSymbolCodeActions.children.length === 0) return;

        this.outputLine(`${indent}${documentSymbolCodeActions.documentSymbol.detail}`);
        for (var ca of documentSymbolCodeActions.codeActions) this.outputLine(`${indent}- ${ca.title}`);
        documentSymbolCodeActions.children.forEach(c => this.outputDocumentSymbolCodeActions(c, indent + "  "));
    }

    private outputFileDiagnostics(fileDiagnostics: FileDiagnostic[]): void {
        if (fileDiagnostics.length === 0) return;

        let previousPath = "";

        fileDiagnostics.forEach(fd => {
            if (previousPath !== fd.path) {
                previousPath = fd.path;
                this.outputLine(`\n[${fd.path}]`, true);
            }

            this.outputLine(fd.toString());
        });
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
            // TODO: see below TODO: let removedProjectReferencesTotalCount = 0;
            let removedUnusedUsingsTotalCount = 0;
            let abortingOrDidCancel = false;

            this.clearOutput();
            this.showOutput();

            const reportProgress = (message: string, incrementPackageReferenceProcessed = false) => {
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

            const isCancellationRequested = () => {
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

                        const textEditor = await vscode.window.showTextDocument(textDocument);


                        await new Promise(f => setTimeout(f, settings.delayBeforeRemovingUnusedUsingDirectives));

                        let removedUnusedUsingsFromFileCount = 0;

                        if (removeUnusedUsings && !sharpenFiles) {
                            removedUnusedUsingsFromFileCount = await CSharpFile.removeUnusedUsings(textEditor);
                        }
                        else if (sharpenFiles) {
                            // eslint-disable-next-line no-unused-vars
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

                        await vscode.window.showTextDocument(textDocument);
                    }

                    if (abortingOrDidCancel) break; // project for-loop

                    this.outputLine(` done`);
                }

                if (projectFileUris.length > 0 || project.packageReferences.length > 0) { // TODO: see below TODO: || project.projectReferences.length > 0) {
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

                // TODO: resolve issue with removing project references
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

                if (project.removedPackageReferences.length > 0) { // TODO: see above TODO: || project.removedProjectReferences.length > 0) {
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

                // TODO: see above TODO
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
        Promise<[sharpened: boolean, removedUnusedUsingsCount: number, symbolsRenamedCount: number, didError: boolean, sharpenError: string | undefined]> {

        const [fileFilterStatus, fileFilterReason] = FileFilter.checkAll(vscode.workspace.asRelativePath(textEditor.document.uri), documentText, settings.fileFilters);
        if (fileFilterStatus === FileFilterStatus.deny) {
            if (!batchProcessing) this.warning(fileFilterReason!);
            return [false, 0, 0, false, fileFilterReason];
        }
        else if (fileFilterStatus === FileFilterStatus.confirm) {
            const result = await vscode.window.showWarningMessage(`${fileFilterReason} — Override and continue? (Changes can be undone)`, "Continue", "Cancel");
            if (result !== "Continue") return [false, 0, 0, false, `Canceled: ${fileFilterReason}`];
        }

        const removedUnusedUsingsCount = settings.removeUnusedUsingsOnSharpen ? await CSharpFile.removeUnusedUsings(textEditor) : 0;
        if (settings.formatDocumentOnSharpen) await vscode.commands.executeCommand('editor.action.formatDocument', textEditor.document.uri);

        let csharpFile;
        let reCreateCSharpFile = false;
        let symbolsRenamedCount = 0;

        do {
            try {
                csharpFile = await CSharpFile.create(textEditor.document);
                if (!csharpFile.hasChildren) {
                    if (!batchProcessing) this.warning("No C# symbols found.");
                    return [false, removedUnusedUsingsCount, symbolsRenamedCount, false, "No C# symbols found"];
                }
            }
            catch (e: any) {
                if (!batchProcessing) this.error(e.message);
                return [false, removedUnusedUsingsCount, symbolsRenamedCount, true, `Error: ${e.message}`];
            }

            if (!batchProcessing && settings.symbolRenamingEnabled && settings.symbolRenaming.length > 0) {
                try {
                    if (reCreateCSharpFile = await this.applySymbolRenaming(settings, textEditor, csharpFile.children)) symbolsRenamedCount++;
                }
                catch (e: any) {
                    reCreateCSharpFile = false;
                    if (!batchProcessing) this.warning(`Error renaming symbol: ${e.message}`);
                    // NOTE: do not return on this error, continue to sharpen file
                }
            }

            // if (reCreateCSharpFile && !batchProcessing) this.outputLine(`Re-parsing symbols after symbol renaming.`);
        } while (reCreateCSharpFile); // NOTE: have to re-create the CSharpFile after each renamed symbol because of the symbol position values changing

        try {
            CSharpOrganizer.organizeFile(settings, csharpFile);
        }
        catch (e: any) {
            if (!batchProcessing) this.error(e.message);
            return [false, removedUnusedUsingsCount, symbolsRenamedCount, true, `Error: ${e.message}`];
        }

        await textEditor.edit(tee => {
            tee.replace(new vscode.Range(CSharpFile.zeroPosition, textEditor.document.positionAt(textEditor.document.getText().length)), csharpFile.text);
        });

        if (settings.formatDocumentOnSharpen) await vscode.commands.executeCommand('editor.action.formatDocument', textEditor.document.uri);

        return [true, removedUnusedUsingsCount, symbolsRenamedCount, false, undefined];
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
