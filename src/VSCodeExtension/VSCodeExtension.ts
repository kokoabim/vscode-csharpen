import * as vscode from "vscode";

import { MessageResult } from "../Models/MessageResult";
import { VSCodeCommand } from "./VSCodeCommand";

export abstract class VSCodeExtension {
    protected context: vscode.ExtensionContext;
    protected fullName: string;
    protected outputChannel: vscode.OutputChannel;
    protected shortName: string;
    protected workspaceFolder?: vscode.WorkspaceFolder;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.fullName = this.packageJsonRootValue("displayName");
        this.shortName = this.packageJsonRootValue("shortName");
        this.outputChannel = vscode.window.createOutputChannel(this.shortName);
    }

    protected addCommands(...commands: VSCodeCommand[]): void {
        commands.forEach(c => this.context.subscriptions.push(vscode.commands.registerCommand(c.name, c.command)));
    }

    protected clearOutput(): void {
        this.outputChannel.clear();
    }

    protected async error(message: string, noPrefix = false): Promise<void> {
        await vscode.window.showErrorMessage(`${noPrefix ? "" : `${this.shortName}: `}${message}`);
    }

    protected async getTextDocument(trySelectedIfNotActive = true, showWarningMessage = true): Promise<vscode.TextDocument | undefined> {
        let document;
        try {
            document = vscode.window.activeTextEditor?.document;
            if (document) return document;

            if (trySelectedIfNotActive) {
                await vscode.commands.executeCommand('copyFilePath');
                const clipboard = await vscode.env.clipboard.readText();
                if (clipboard) {
                    document = await vscode.workspace.openTextDocument(clipboard);
                    if (document) return document;
                }
            }
        }
        // eslint-disable-next-line no-unused-vars
        catch (e) { }

        if (showWarningMessage) { this.warning("No document opened or selected."); }

        return undefined;
    }

    protected async getTextEditor(showWarningMessage = true): Promise<vscode.TextEditor | undefined> {
        const textEditor = vscode.window.activeTextEditor;
        if (!textEditor && showWarningMessage) await this.warning("No editor is open.");
        return textEditor;
    }

    protected async information(message: string, noPrefix = false): Promise<void> {
        await vscode.window.showInformationMessage(`${noPrefix ? "" : `${this.shortName}: `}${message}`);
    }

    protected async isWorkspaceReady(showWarningMessage = true): Promise<boolean> {
        this.workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : undefined;

        if (!this.workspaceFolder) {
            if (showWarningMessage) await this.warning("No workspace is open.");
            return false;
        }

        return true;
    }

    protected output(message: string, show = false, preserveFocus = true): void {
        if (show) this.outputChannel.show(preserveFocus);
        this.outputChannel.append(message);
    }

    protected outputLine(message: string, show = false, preserveFocus = true): void {
        if (show) this.outputChannel.show(preserveFocus);
        this.outputChannel.appendLine(message);
    }

    protected packageJsonRootValue(name: string): any {
        return this.context.extension.packageJSON[name];
    }

    protected async showMessage(messageResult: MessageResult): Promise<boolean> {
        if (!messageResult.message) return false;

        if (messageResult.level === vscode.LogLevel.Info) await this.information(messageResult.message);
        else if (messageResult.level === vscode.LogLevel.Error) await this.error(messageResult.message);
        else if (messageResult.level === vscode.LogLevel.Warning) await this.warning(messageResult.message);
        else return false;

        return true;
    }

    protected showOutput(preserveFocus = true): void {
        this.outputChannel.show(preserveFocus);
    }

    protected async warning(message: string, noPrefix = false): Promise<void> {
        await vscode.window.showWarningMessage(`${noPrefix ? "" : `${this.shortName}: `}${message}`);
    }
}
