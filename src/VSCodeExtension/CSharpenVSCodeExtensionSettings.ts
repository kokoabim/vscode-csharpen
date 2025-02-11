import * as fs from "fs/promises";
import * as vscode from 'vscode';

import { CSharpOrganizeSettings } from "../CSharp/CSharpOrganizeSettings";
import { CSharpenWorkspaceSettings } from "./CSharpenWorkspaceSettings";
import { CodingStyles } from "../Utils/CodingStyles";
import { FileFilter } from "../Models/FileFilter";
import { SymbolRename } from "../Utils/SymbolRename";
import { VSCodeExtensionSettings } from "./VSCodeExtensionSettings";

export class CSharpenVSCodeExtensionSettings extends VSCodeExtensionSettings {
    // ! IMPORTANT: update function readConfigurations() below and class CSharpenWorkspaceSettings if new settings are added

    allowSharpenWithFileDiagnosticErrors = false;
    autoGeneratedPatterns = ["^\\s*// <auto-generated>"];
    codingStyles = CSharpenVSCodeExtensionSettings.defaultCodingStyles;
    codingStylesEnabled = false;
    delayBeforeRemovingUnusedUsingDirectives = 300;
    doNotRemoveThesePackageReferences = CSharpenVSCodeExtensionSettings.defaultDoNotRemoveThesePackageReferences;
    enforceFileScopedNamespaces = true;
    fileFilters = CSharpenVSCodeExtensionSettings.defaultFileFilters;
    formatDocumentOnSharpen = true;
    indentation!: string; // not read from extension setting but from editor settings
    namespaceLevelOrganization = CSharpOrganizeSettings.defaultNamespaceLevelOrganization;
    quickFixFilters = CSharpenVSCodeExtensionSettings.defaultQuickFixFilters;
    regionalizeInterfaceImplementations = CSharpenVSCodeExtensionSettings.getRegionalizeInterfaceImplementations(["*"]);
    removeUnusedUsingsOnSharpen = true;
    sharpenFilesWhenRemovingUnusedReferences = false;
    showFileSizeDifferenceOnSharpen = true;
    skipAutoGeneratedFileWhenRemovingUnusedReferences = true;
    symbolRenaming = CSharpenVSCodeExtensionSettings.defaultSymbolRenaming;
    symbolRenamingEnabled = false;
    typeLevelOrganization = CSharpOrganizeSettings.defaultTypeLevelOrganization;

    protected readonly configurationSection = "csharpen";

    private static _shared: CSharpenVSCodeExtensionSettings;

    constructor(readConfigurations = true, doNotUseWorkspaceSettings = false) {
        super();
        if (readConfigurations) CSharpenVSCodeExtensionSettings.readConfigurations(this, doNotUseWorkspaceSettings);
    }

    static get defaultAutoGeneratedPatterns() {
        return [
            "^[ \\t]*/{2,3}[^\\r\\n]*<auto-generated\\b"
        ];
    }

    static get defaultCodingStyles() {
        return new CodingStyles({});
    }

    static get defaultDoNotRemoveThesePackageReferences() {
        return [
            "coverlet.collector",
            "coverlet.msbuild",
            "Microsoft.NET.Sdk",
            "Microsoft.NET.Sdk.Web",
            "Microsoft.NET.Test.Sdk",
            "Microsoft.EntityFrameworkCore.Design;Microsoft.EntityFrameworkCore",
            "Microsoft.EntityFrameworkCore.Tools;Microsoft.EntityFrameworkCore",
            "xunit.runner.visualstudio"
        ];
    }

    static get defaultFileFilters() {
        return [
            {
                "confirmOnDeny": false,
                "fileName": "/[Pp]rogram\\.cs$",
                "matchLogic": false,
                "name": "ProgramClass",
                "pattern": "\\bclass\\s+Program\\s*\\{",
                "reason": "Program.cs requires a Program class"
            },
            {
                "confirmOnDeny": false,
                "fileName": "/[Pp]rogram\\.cs$",
                "matchLogic": false,
                "name": "ProgramClassMainMethod",
                "pattern": "\\bstatic\\s+((void)|(int)|((System\\.)?Int32)|(async\\s+Task(<((int)|((System\\.)?Int32))>)?))\\s+Main\\s*\\(.*?\\)",
                "reason": "Program class requires a static Main method"
            },
            {
                "confirmOnDeny": true,
                "matchLogic": true,
                "name": "PreprocessorDirective:#elif",
                "pattern": "\\n\\s*?#elif\\s+.*?[\\r\\n]+",
                "reason": "Preprocessor directive #elif is detected. If outside of type members, it may cause unexpected behavior."
            },
            {
                "confirmOnDeny": true,
                "matchLogic": true,
                "name": "PreprocessorDirective:#else",
                "pattern": "\\n\\s*?#else\\s*?[\\r\\n]+",
                "reason": "Preprocessor directive #else is detected. If outside of type members, it may cause unexpected behavior."
            }
        ] as FileFilter[];
    }

    static get defaultQuickFixFilters() {
        return [
            "^Fix All",
            "^Suppress or configure issues",
            "^Convert to block scoped namespace",
            "^Use primary constructor",
            "^Add braces",
            "^Use block body for method",
            "^Use explicit type instead of 'var'",
            "^Fix using Copilot",
            "^Explain using Copilot"
        ];
    }

    static get defaultSymbolRenaming() {
        return [] as SymbolRename[];
    }

    static get regionalizableGenericInterfaceImplementations() {
        return [
            "IList",
            "ICollection",
            "IEnumerable",

            "IComparable",
            "IEqualityComparer",
            "IEquatable",
        ];
    }

    static get regionalizableInterfaceImplementations() {
        return [
            "IDisposable",
            "IAsyncDisposable",

            "IList",
            "ICollection",
            "IEnumerable",

            "ICloneable",
            "IComparable",
            "IConvertible",
            "IFormattable",
        ];
    }

    static createWorkspaceSettingsFromExtensionSettings(useDefaults = false): CSharpenWorkspaceSettings {
        const extensionSettings = new CSharpenVSCodeExtensionSettings(!useDefaults, true);

        const workspaceSettings = new CSharpenWorkspaceSettings();
        workspaceSettings.allowSharpenWithFileDiagnosticErrors = extensionSettings.allowSharpenWithFileDiagnosticErrors;
        workspaceSettings.autoGeneratedPatterns = extensionSettings.autoGeneratedPatterns;
        workspaceSettings.codingStyles = extensionSettings.codingStyles;
        workspaceSettings.codingStylesEnabled = extensionSettings.codingStylesEnabled;
        workspaceSettings.delayBeforeRemovingUnusedUsingDirectives = extensionSettings.delayBeforeRemovingUnusedUsingDirectives;
        workspaceSettings.doNotRemoveThesePackageReferences = extensionSettings.doNotRemoveThesePackageReferences;
        workspaceSettings.enforceFileScopedNamespaces = extensionSettings.enforceFileScopedNamespaces;
        workspaceSettings.fileFilters = extensionSettings.fileFilters;
        workspaceSettings.formatDocumentOnSharpen = extensionSettings.formatDocumentOnSharpen;
        workspaceSettings.namespaceLevelOrganization = extensionSettings.namespaceLevelOrganization;
        workspaceSettings.quickFixFilters = extensionSettings.quickFixFilters;
        workspaceSettings.regionalizeInterfaceImplementations = extensionSettings.regionalizeInterfaceImplementations;
        workspaceSettings.removeUnusedUsingsOnSharpen = extensionSettings.removeUnusedUsingsOnSharpen;
        workspaceSettings.sharpenFilesWhenRemovingUnusedReferences = extensionSettings.sharpenFilesWhenRemovingUnusedReferences;
        workspaceSettings.showFileSizeDifferenceOnSharpen = extensionSettings.showFileSizeDifferenceOnSharpen;
        workspaceSettings.skipAutoGeneratedFileWhenRemovingUnusedReferences = extensionSettings.skipAutoGeneratedFileWhenRemovingUnusedReferences;
        workspaceSettings.symbolRenaming = extensionSettings.symbolRenaming;
        workspaceSettings.symbolRenamingEnabled = extensionSettings.symbolRenamingEnabled;
        workspaceSettings.typeLevelOrganization = extensionSettings.typeLevelOrganization;

        return workspaceSettings;
    }

    static overrideValues(extensionSettings: CSharpenVSCodeExtensionSettings, workspaceSettings: CSharpenWorkspaceSettings): CSharpenVSCodeExtensionSettings {
        if (workspaceSettings.allowSharpenWithFileDiagnosticErrors !== undefined) extensionSettings.allowSharpenWithFileDiagnosticErrors = workspaceSettings.allowSharpenWithFileDiagnosticErrors;
        if (workspaceSettings.autoGeneratedPatterns !== undefined) extensionSettings.autoGeneratedPatterns = workspaceSettings.autoGeneratedPatterns;
        if (workspaceSettings.codingStyles !== undefined) extensionSettings.codingStyles = workspaceSettings.codingStyles;
        if (workspaceSettings.codingStylesEnabled !== undefined) extensionSettings.codingStylesEnabled = workspaceSettings.codingStylesEnabled;
        if (workspaceSettings.delayBeforeRemovingUnusedUsingDirectives !== undefined) extensionSettings.delayBeforeRemovingUnusedUsingDirectives = workspaceSettings.delayBeforeRemovingUnusedUsingDirectives;
        if (workspaceSettings.doNotRemoveThesePackageReferences !== undefined) extensionSettings.doNotRemoveThesePackageReferences = workspaceSettings.doNotRemoveThesePackageReferences;
        if (workspaceSettings.enforceFileScopedNamespaces !== undefined) extensionSettings.enforceFileScopedNamespaces = workspaceSettings.enforceFileScopedNamespaces;
        if (workspaceSettings.fileFilters !== undefined) extensionSettings.fileFilters = workspaceSettings.fileFilters;
        if (workspaceSettings.formatDocumentOnSharpen) extensionSettings.formatDocumentOnSharpen = workspaceSettings.formatDocumentOnSharpen;
        if (workspaceSettings.namespaceLevelOrganization !== undefined) extensionSettings.namespaceLevelOrganization = workspaceSettings.namespaceLevelOrganization;
        if (workspaceSettings.quickFixFilters !== undefined) extensionSettings.quickFixFilters = workspaceSettings.quickFixFilters;
        if (workspaceSettings.regionalizeInterfaceImplementations !== undefined) extensionSettings.regionalizeInterfaceImplementations = workspaceSettings.regionalizeInterfaceImplementations;
        if (workspaceSettings.removeUnusedUsingsOnSharpen !== undefined) extensionSettings.removeUnusedUsingsOnSharpen = workspaceSettings.removeUnusedUsingsOnSharpen;
        if (workspaceSettings.sharpenFilesWhenRemovingUnusedReferences !== undefined) extensionSettings.sharpenFilesWhenRemovingUnusedReferences = workspaceSettings.sharpenFilesWhenRemovingUnusedReferences;
        if (workspaceSettings.showFileSizeDifferenceOnSharpen !== undefined) extensionSettings.showFileSizeDifferenceOnSharpen = workspaceSettings.showFileSizeDifferenceOnSharpen;
        if (workspaceSettings.skipAutoGeneratedFileWhenRemovingUnusedReferences !== undefined) extensionSettings.skipAutoGeneratedFileWhenRemovingUnusedReferences = workspaceSettings.skipAutoGeneratedFileWhenRemovingUnusedReferences;
        if (workspaceSettings.symbolRenaming !== undefined) extensionSettings.symbolRenaming = workspaceSettings.symbolRenaming;
        if (workspaceSettings.symbolRenamingEnabled !== undefined) extensionSettings.symbolRenamingEnabled = workspaceSettings.symbolRenamingEnabled;
        if (workspaceSettings.typeLevelOrganization !== undefined) extensionSettings.typeLevelOrganization = workspaceSettings.typeLevelOrganization;

        return extensionSettings;
    }

    static shared(refresh = false, doNotUseWorkspaceSettings = false): CSharpenVSCodeExtensionSettings {
        if (!this._shared) CSharpenVSCodeExtensionSettings._shared = new CSharpenVSCodeExtensionSettings(true, doNotUseWorkspaceSettings);
        else if (refresh) CSharpenVSCodeExtensionSettings.readConfigurations(CSharpenVSCodeExtensionSettings._shared, doNotUseWorkspaceSettings);

        return this._shared;
    }

    static async writeWorkspaceFileUsingSettings(): Promise<boolean> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) return false;

        const workspaceSettings = this.createWorkspaceSettingsFromExtensionSettings();

        const filePath = workspaceFolder + "/" + CSharpenWorkspaceSettings.fileName;
        await fs.writeFile(filePath, JSON.stringify(workspaceSettings, null, 4));

        return true;
    }

    static async writeWorkspaceFileWithDefaults(): Promise<boolean> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) return false;

        const defaultWorkspaceSettings = CSharpenVSCodeExtensionSettings.createWorkspaceSettingsFromExtensionSettings(true);

        const filePath = workspaceFolder + "/" + CSharpenWorkspaceSettings.fileName;
        await fs.writeFile(filePath, JSON.stringify(defaultWorkspaceSettings, null, 4));

        return true;
    }

    private static assignFromConfiguration(settings: CSharpOrganizeSettings, fromConfiguration: CSharpOrganizeSettings | undefined) {
        if (fromConfiguration) {
            if (fromConfiguration.doNotRegionalizeMembersOf?.length > 0) settings.doNotRegionalizeMembersOf = fromConfiguration.doNotRegionalizeMembersOf;
            if (fromConfiguration.doNotRegionalizeTypes?.length > 0) settings.doNotRegionalizeTypes = fromConfiguration.doNotRegionalizeTypes;
            if (fromConfiguration.onlyRegionalizeMembersOf?.length > 0) settings.onlyRegionalizeMembersOf = fromConfiguration.onlyRegionalizeMembersOf;
            if (fromConfiguration.onlyRegionalizeTypes?.length > 0) settings.onlyRegionalizeTypes = fromConfiguration.onlyRegionalizeTypes;
            if (fromConfiguration.ordering?.length > 0) settings.ordering = fromConfiguration.ordering;
            if (fromConfiguration.regionalization?.length > 0) settings.regionalization = fromConfiguration.regionalization;
            if (fromConfiguration.regionThreshold >= 0) settings.regionThreshold = fromConfiguration.regionThreshold;
            if (fromConfiguration.typeSort?.length > 0) settings.typeSort = CSharpOrganizeSettings.filterTypeSort(fromConfiguration.typeSort);
        }
    }

    private static getRegionalizeInterfaceImplementations(regionalizeInterfaceImplementations: string[]): string[] {
        if (regionalizeInterfaceImplementations.includes("*")) {
            regionalizeInterfaceImplementations = [...new Set(CSharpenVSCodeExtensionSettings.regionalizableInterfaceImplementations.concat(...CSharpenVSCodeExtensionSettings.regionalizableGenericInterfaceImplementations))];
        }
        else if (regionalizeInterfaceImplementations.length > 0) {
            if (regionalizeInterfaceImplementations.includes("IList")) regionalizeInterfaceImplementations = [...new Set(regionalizeInterfaceImplementations.concat(...["ICollection", "IEnumerable"]))];
            else if (regionalizeInterfaceImplementations.includes("ICollection")) regionalizeInterfaceImplementations = [...new Set(regionalizeInterfaceImplementations.concat(...["IEnumerable"]))];
        }

        if (regionalizeInterfaceImplementations.includes("IDisposable") && regionalizeInterfaceImplementations.includes("IAsyncDisposable")) {
            regionalizeInterfaceImplementations.splice(regionalizeInterfaceImplementations.indexOf("IAsyncDisposable"), 1); // IAsyncDisposable is covered by IDisposable
        }

        return regionalizeInterfaceImplementations;
    }

    private static readConfigurations(settings: CSharpenVSCodeExtensionSettings, doNotUseWorkspaceSettings = false): void {
        const editorConfig = vscode.workspace.getConfiguration("editor");
        settings.indentation = editorConfig.get("insertSpaces") as boolean ? " ".repeat(editorConfig.get("tabSize") as number) : "\t";

        if (!settings.hasConfiguration()) return;

        const codingStyles = settings.get<CodingStyles>("codingStyles");
        if (codingStyles) settings.codingStyles = new CodingStyles(codingStyles);

        const fileFilters = settings.get<FileFilter[]>("fileFilters");
        if (fileFilters) settings.fileFilters = fileFilters.map(ff => new FileFilter(ff));

        const symbolRenaming = settings.get<SymbolRename[]>("symbolRenaming");
        if (symbolRenaming) settings.symbolRenaming = symbolRenaming.map(ff => new SymbolRename(ff));

        settings.allowSharpenWithFileDiagnosticErrors = settings.get<boolean>("allowSharpenWithFileDiagnosticErrors") ?? false;
        settings.autoGeneratedPatterns = settings.get<string[]>("autoGeneratedPatterns") ?? [];
        settings.codingStylesEnabled = settings.get<boolean>("codingStylesEnabled") ?? false;
        settings.delayBeforeRemovingUnusedUsingDirectives = settings.get<number>("delayBeforeRemovingUnusedUsingDirectives") ?? 0;
        settings.doNotRemoveThesePackageReferences = settings.get<string[]>("doNotRemoveThesePackageReferences") ?? [];
        settings.enforceFileScopedNamespaces = settings.get<boolean>("enforceFileScopedNamespaces") ?? true;
        settings.formatDocumentOnSharpen = settings.get<boolean>("formatDocumentOnSharpen") ?? true;
        settings.quickFixFilters = settings.get<string[]>("quickFixFilters") ?? [];
        settings.regionalizeInterfaceImplementations = settings.get<string[]>("regionalizeInterfaceImplementations") ?? [];
        settings.removeUnusedUsingsOnSharpen = settings.get<boolean>("removeUnusedUsingsOnSharpen") ?? true;
        settings.sharpenFilesWhenRemovingUnusedReferences = settings.get<boolean>("sharpenFilesWhenRemovingUnusedReferences") ?? false;
        settings.showFileSizeDifferenceOnSharpen = settings.get<boolean>("showFileSizeDifferenceOnSharpen") ?? false;
        settings.skipAutoGeneratedFileWhenRemovingUnusedReferences = settings.get<boolean>("skipAutoGeneratedFileWhenRemovingUnusedReferences") ?? true;
        settings.symbolRenamingEnabled = settings.get<boolean>("symbolRenamingEnabled") ?? false;

        settings.regionalizeInterfaceImplementations = CSharpenVSCodeExtensionSettings.getRegionalizeInterfaceImplementations(settings.regionalizeInterfaceImplementations);

        CSharpenVSCodeExtensionSettings.assignFromConfiguration(settings.namespaceLevelOrganization, settings.get<CSharpOrganizeSettings>("namespaceLevelOrganization"));
        CSharpenVSCodeExtensionSettings.assignFromConfiguration(settings.typeLevelOrganization, settings.get<CSharpOrganizeSettings>("typeLevelOrganization"));

        if (!doNotUseWorkspaceSettings && vscode.workspace.workspaceFolders) {
            const workspaceSettings = CSharpenWorkspaceSettings.readFile(vscode.workspace.workspaceFolders[0].uri.fsPath);
            if (workspaceSettings) CSharpenVSCodeExtensionSettings.overrideValues(settings, workspaceSettings);
        }
    }
}
