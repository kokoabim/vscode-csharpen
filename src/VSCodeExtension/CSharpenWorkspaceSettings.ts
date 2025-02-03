import * as fs from "fs/promises";
import * as fsSync from "fs";
import { CSharpOrganizeSettings } from "../CSharp/CSharpOrganizeSettings";
import { FileFilter } from "../Models/FileFilter";

export class CSharpenWorkspaceSettings {
    static readonly fileName = ".csharpen.json";

    allowSharpenWithFileDiagnosticErrors: boolean | undefined;
    delayBeforeRemovingUnusedUsingDirectives: number | undefined;
    doNotRemoveThesePackageReferences: string[] | undefined;
    enforceFileScopedNamespaces: boolean | undefined;
    fileFilters: FileFilter[] | undefined;
    formatDocumentOnSharpen: boolean | undefined;
    namespaceLevelOrganization: CSharpOrganizeSettings | undefined;
    quickFixFilters: string[] | undefined;
    regionalizeInterfaceImplementations: string[] | undefined;
    removeUnusedUsingsOnSharpen: boolean | undefined;
    sharpenFilesWhenRemovingUnusedReferences: boolean | undefined;
    showFileSizeDifferenceOnSharpen: boolean | undefined;
    typeLevelOrganization: CSharpOrganizeSettings | undefined;

    static readFile(workspaceFolder: string): CSharpenWorkspaceSettings | undefined {
        const filePath = workspaceFolder + "/" + this.fileName;

        try { fsSync.accessSync(filePath, fsSync.constants.R_OK); }
        catch { return undefined; }

        const workspaceSettingsInstance = new CSharpenWorkspaceSettings();
        const workspaceSettingsDeserialized = JSON.parse(fsSync.readFileSync(filePath, "utf8")) as CSharpenWorkspaceSettings;

        return Object.assign(workspaceSettingsInstance, workspaceSettingsDeserialized);
    }

    static async readFileAsync(workspaceFolder: string): Promise<CSharpenWorkspaceSettings | undefined> {
        const filePath = workspaceFolder + "/" + this.fileName;

        try { await fs.access(filePath, fs.constants.R_OK); }
        catch { return undefined; }

        const workspaceSettingsInstance = new CSharpenWorkspaceSettings();
        const workspaceSettingsDeserialized = (await this.readFileAsJsonAsync(filePath)) as CSharpenWorkspaceSettings;

        return Object.assign(workspaceSettingsInstance, workspaceSettingsDeserialized);
    }

    private static async readFileAsJsonAsync(filePath: string): Promise<any> {
        return new Promise<string>(async (resolve, reject) => {
            await fs.readFile(filePath).then(data => {
                resolve(JSON.parse(Buffer.from(<Uint8Array>data).toString("utf8")));
            }, err => {
                reject(err);
            });
        });
    }
}