import { CSharpenVSCodeExtensionSettings } from "./CSharpenVSCodeExtensionSettings";
import { CSharpFile } from '../CSharp/CSharpFile';
import { CSharpOrganizer } from "../CSharp/CSharpOrganizer";
import { FileDiagnostic, FileDiagnosticSeverity } from "../Models/FileDiagnostic";
import { FileFilter, FileFilterStatus } from "../Models/FileFilter";
import { VSCodeCommand } from "./VSCodeCommand";
import { VSCodeExtension } from "./VSCodeExtension";
import * as vscode from "vscode";
import { CSharpProjectFile, CSharpProjectPackageReference } from "../CSharp/CSharpProjectFile";
import { FileSystem } from "../Utils/FileSystem";

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
            this.createSharpenProjectFilesCommand());
    }

    static use(context: vscode.ExtensionContext): CSharpenVSCodeExtension {
        return new CSharpenVSCodeExtension(context);
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

                this.outputLine(`\n[${project.name}: ${project.relativePath}] Opening and outputting file diagnostics for ${fileUris.length} C# files...`);

                for (const f of fileUris) {
                    const textDocument = await vscode.workspace.openTextDocument(f);
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const textEditor = await vscode.window.showTextDocument(textDocument);
                }

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

            if ("Yes" !== (await vscode.window.showInformationMessage(
                `Remove unused references in ${projects.length === 1 ? "project" : `${projects.length} projects`}?`,
                {
                    modal: true,
                    detail: `This will open and remove unused using directives of all C# files in ${projects.length === 1 ? `project ${projects[0].name}` : `${projects.length} projects`}.\n\nThis process can take a few minutes depending on the number of projects, files and references.\n\nModifications can be undone.`,
                },
                "Yes", "No"))) return;

            const settings = CSharpenVSCodeExtensionSettings.shared(true);

            const workspaceFiles = await vscode.workspace.findFiles("**/*.cs");
            let filesCount = 0;
            let removedPackageReferencesCount = 0;
            // TODO: see below TODO: let removedProjectReferencesCount = 0;
            let removedUnusedUsingsCount = 0;

            this.clearOutput();
            this.showOutput();

            for await (const project of projects) {
                const fileUris = workspaceFiles.filter(f => f.path.includes(project.directory + "/")).sort((a, b) => a.path.localeCompare(b.path));
                if (fileUris.length > 0) {
                    filesCount += fileUris.length;

                    this.output(`\n[${project.name}] Removing unused using directives for ${fileUris.length} C# files...`);

                    for await (const fileUri of fileUris) {
                        const textDocument = await vscode.workspace.openTextDocument(fileUri);
                        await vscode.window.showTextDocument(textDocument);
                    }

                    this.outputLine(` done`);
                }

                if (fileUris.length > 0 || project.packageReferences.length > 0 || project.projectReferences.length > 0) {
                    const didBuildSolution = await projects[0].buildSolutionAsync(this.outputChannel, " - ", false);
                    if (!didBuildSolution) return;

                    if (fileUris.length > 0) {
                        this.output(` - Removing unused using directives...`);

                        let removedCount = 0;

                        for await (const fileUri of fileUris) {
                            try {
                                const textDocument = await vscode.workspace.openTextDocument(fileUri);
                                const textEditor = await vscode.window.showTextDocument(textDocument);
                                await new Promise(f => setTimeout(f, settings.delayBeforeRemovingUnusedUsingDirectives));
                                removedCount += await CSharpFile.removeUnusedUsings(textEditor);
                            }
                            catch (e: any) {
                                this.outputLine(" Error: " + e.message);
                                return;
                            }
                        }

                        removedUnusedUsingsCount += removedCount;

                        if (removedCount > 0) this.outputLine(` removed ${removedCount}`);
                        else this.outputLine(` none found`);
                    }
                }

                if (project.packageReferences.length > 0) {
                    const conditionalPackageReferenceRemovals: { conditionalReference: string, possibleRemoval: CSharpProjectPackageReference }[] = [];

                    for await (const packageReference of project.packageReferences) {
                        const doNotRemoveConfig = settings.doNotRemoveThesePackageReferences.find(d => packageReference.name === d || d.startsWith(packageReference.name + ";"));
                        if (doNotRemoveConfig) {
                            let continueAfter = true;

                            if (!doNotRemoveConfig.includes(";")) {
                                this.outputLine(`\n[${project.name}] Skipping ${packageReference.name} since it is configured not to be removed`);
                            }
                            else {
                                const doNotRemoveConfigSplit = doNotRemoveConfig.split(";");
                                if (doNotRemoveConfigSplit.length !== 2) {
                                    this.outputLine(`\n[${project.name}] Skipping ${packageReference.name} since its configuration to skip is improper ‼️`);
                                }
                                else {
                                    const conditionalReference = doNotRemoveConfigSplit[1];
                                    if (project.packageReferences.find(pr => pr.name === conditionalReference) === undefined) {
                                        continueAfter = false; // "conditionalReference" does not exist so try to remove "packageReference" now
                                    }
                                    else {
                                        conditionalPackageReferenceRemovals.push({ conditionalReference: conditionalReference, possibleRemoval: packageReference });
                                    }
                                }
                            }

                            if (continueAfter) continue;
                        }

                        await project.removePackageReferenceAsync(this.outputChannel, packageReference);
                    }

                    if (conditionalPackageReferenceRemovals.length > 0) {
                        const packageReferenceRemovals = conditionalPackageReferenceRemovals.filter(cpr => project.packageReferences.find(pr => pr.name === cpr.conditionalReference) === undefined).map(cpr => cpr.possibleRemoval);

                        if (packageReferenceRemovals.length > 0) {
                            for await (const packageReference of packageReferenceRemovals) {
                                await project.removePackageReferenceAsync(this.outputChannel, packageReference);
                            }
                        }
                    }

                    if (project.removedPackageReferences.length > 0) {
                        removedPackageReferencesCount += project.removedPackageReferences.length;

                        this.outputLine(`\n[${project.name}] Removed ${project.removedPackageReferences.length} package references:`);
                        project.removedPackageReferences.forEach(r => this.outputLine(` - ${r.name}`));
                    }
                }

                // TODO: resolve issue with removing project references
                /*if (project.projectReferences.length > 0) {
                    for await (const projectReference of project.projectReferences) {
                        await project.removeProjectReferenceAsync(this.outputChannel, projectReference);
                    }

                    if (project.removedProjectReferences.length > 0) {
                        removedProjectReferencesCount += project.removedProjectReferences.length;

                        this.outputLine(`\n[${project.name}] Removed ${project.removedProjectReferences.length} project references:`);
                        project.removedProjectReferences.forEach(r => this.outputLine(` - ${r.name}`));
                    }
                }*/

                if (project.removedPackageReferences.length > 0 || project.removedProjectReferences.length > 0) {
                    if (fileUris.length > 0) {
                        this.output(`\n[${project.name}] Repeating to remove unused using directives for ${fileUris.length} C# files...`);

                        let removedCount = 0;

                        for await (const fileUri of fileUris) {
                            try {
                                const textDocument = await vscode.workspace.openTextDocument(fileUri);
                                const textEditor = await vscode.window.showTextDocument(textDocument);
                                await new Promise(f => setTimeout(f, settings.delayBeforeRemovingUnusedUsingDirectives));
                                removedCount += await CSharpFile.removeUnusedUsings(textEditor);
                            }
                            catch (e: any) {
                                this.outputLine(" Error: " + e.message);
                                return;
                            }
                        }

                        removedUnusedUsingsCount += removedCount;

                        if (removedCount > 0) this.outputLine(` removed ${removedCount}`);
                        else this.outputLine(` none found`);
                    }
                }
            }

            if (projects.length > 1) {
                if (removedPackageReferencesCount > 0) {
                    this.outputLine(`\nRemoved ${removedPackageReferencesCount} package references from ${projects.length} projects:`);
                    projects.filter(p => p.removedPackageReferences.length > 0).flatMap(p => ` - ${p.name} (${p.removedPackageReferences.length}):\n   - ${p.removedPackageReferences.flatMap(rp => rp.name).join("\n   - ")}`).forEach(p => this.outputLine(p));
                }

                // TODO: see above TODO
                // if (removedProjectReferencesCount > 0) {
                //     this.outputLine(`\nRemoved ${removedProjectReferencesCount} project references from ${projects.length} projects:`);
                //     projects.flatMap(p => ` - ${p.name} (${p.removedProjectReferences.length}):\n   - ${p.removedProjectReferences.flatMap(rp => rp.name).join("\n   - ")}`).forEach(p => this.outputLine(p));
                // }

                if (removedUnusedUsingsCount > 0) {
                    this.outputLine(`\nRemoved ${removedUnusedUsingsCount} unused using directives from ${filesCount} files`);
                }
            }

            this.outputLine(`\nFinished removing unused using directives and unused package references 🏁`);
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

            const [fileFilterStatus, fileFilterReason] = FileFilter.checkAll(vscode.workspace.asRelativePath(textEditor.document.uri), documentText, settings.fileFilters);
            if (fileFilterStatus === FileFilterStatus.deny) {
                this.warning(fileFilterReason!);
                return;
            }
            else if (fileFilterStatus === FileFilterStatus.confirm) {
                const result = await vscode.window.showWarningMessage(`${fileFilterReason} — Override and continue? (Changes can be undone)`, "Continue", "Cancel");
                if (result !== "Continue") return;
            }

            if (settings.removeUnusedUsingsOnSharpen) await CSharpFile.removeUnusedUsings(textEditor);
            if (settings.formatDocumentOnSharpen) await vscode.commands.executeCommand('editor.action.formatDocument', textEditor.document.uri);

            let csharpFile;
            try {
                csharpFile = await CSharpFile.create(textEditor.document);
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
                tee.replace(new vscode.Range(CSharpFile.zeroPosition, textEditor.document.positionAt(textEditor.document.getText().length)), csharpFile.text);
            });

            if (settings.formatDocumentOnSharpen) await vscode.commands.executeCommand('editor.action.formatDocument', textEditor.document.uri);

            let fileSizeDiffText = "";
            if (settings.showFileSizeDifferenceOnSharpen) {
                const fileSizeBefore = documentText.length;
                const fileSizeAfter = textEditor.document.getText().length;
                const fileSizeDiff = fileSizeAfter - fileSizeBefore;
                fileSizeDiffText = ` (${fileSizeDiff > 0 ? `+${fileSizeDiff}` : fileSizeDiff.toString()} size difference)`;
            }

            this.information(`Sharpened.${fileSizeDiffText}`);
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
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
