import { VSCodeCommand } from "./VSCodeCommand";
import * as vscode from "vscode";

/**
 * VS Code extension
 */
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

    protected async error(message: string): Promise<void> {
        await vscode.window.showErrorMessage(`${this.shortName}: ${message}`);
    }

    protected async information(message: string): Promise<void> {
        await vscode.window.showInformationMessage(`${this.shortName}: ${message}`);
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

    protected showOutput(preserveFocus = true): void {
        this.outputChannel.show(preserveFocus);
    }

    protected async warning(message: string): Promise<void> {
        await vscode.window.showWarningMessage(`${this.shortName}: ${message}`);
    }
}
