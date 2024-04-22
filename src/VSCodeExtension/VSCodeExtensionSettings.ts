import * as vscode from "vscode";

export abstract class VSCodeExtensionSettings {
    protected abstract configurationSection: string;

    get<T>(name: string): T | undefined {
        const configuration = vscode.workspace.getConfiguration(this.configurationSection);
        if (!configuration) { return; }

        try { return configuration.get<T>(name); }
        catch { return; }
    }

    hasConfiguration(): boolean {
        return !!vscode.workspace.getConfiguration(this.configurationSection);
    }
}
