import * as vscode from "vscode";

export abstract class VSCodeExtensionSettings {
    protected abstract configurationSection: string;

    public get<T>(name: string): T | undefined {
        const configuration = vscode.workspace.getConfiguration(this.configurationSection);
        if (!configuration) { return; }

        try { return configuration.get<T>(name); }
        catch { return; }
    }

    public hasConfiguration(): boolean {
        return !!vscode.workspace.getConfiguration(this.configurationSection);
    }

    public set<T>(name: string, value: T, configurationTarget: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Thenable<void> {
        return vscode.workspace.getConfiguration(this.configurationSection).update(name, value, configurationTarget);
    }
}
