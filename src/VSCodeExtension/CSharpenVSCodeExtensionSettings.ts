import { CSharpOrganizeSettings } from "../CSharp/CSharpOrganizeSettings";
import { FileFilter } from "../Models/FileFilter";
import { VSCodeExtensionSettings } from "./VSCodeExtensionSettings";
import * as vscode from 'vscode';

export class CSharpenVSCodeExtensionSettings extends VSCodeExtensionSettings {
    static readonly regionalizableGenericInterfaceImplementations = [
        "IList",
        "ICollection",
        "IEnumerable",

        "IComparable",
        "IEqualityComparer",
        "IEquatable",
    ];
    static readonly regionalizableInterfaceImplementations = [
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

    allowSharpenWithFileDiagnosticErrors = false;
    fileFilters: FileFilter[] = [];
    formatDocumentOnSharpen = true;
    indentation!: string;
    namespaceLevelOrganization = new CSharpOrganizeSettings();
    quickFixFilters: string[] = [];
    regionalizeInterfaceImplementations: string[] = [];
    removeUnusedUsingsOnSharpen = true;
    showFileSizeDifferenceOnSharpen = false;
    typeLevelOrganization = new CSharpOrganizeSettings();

    protected readonly configurationSection = "csharpen";

    private static _shared: CSharpenVSCodeExtensionSettings;

    private constructor() {
        super();
        CSharpenVSCodeExtensionSettings.readConfigurations(this);
    }

    static shared(refresh = false): CSharpenVSCodeExtensionSettings {
        if (!this._shared) CSharpenVSCodeExtensionSettings._shared = new CSharpenVSCodeExtensionSettings();
        else if (refresh) CSharpenVSCodeExtensionSettings.readConfigurations(CSharpenVSCodeExtensionSettings._shared);

        return this._shared;
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

    private static readConfigurations(settings: CSharpenVSCodeExtensionSettings): void {
        const editorConfig = vscode.workspace.getConfiguration("editor");
        settings.indentation = editorConfig.get("insertSpaces") as boolean ? " ".repeat(editorConfig.get("tabSize") as number) : "\t";

        if (!settings.hasConfiguration()) return;

        const fileFilters = settings.get<FileFilter[]>("fileFilters");
        if (fileFilters) settings.fileFilters = fileFilters.map(ff => new FileFilter(ff));

        settings.formatDocumentOnSharpen = settings.get<boolean>("formatDocumentOnSharpen") ?? true;
        settings.quickFixFilters = settings.get<string[]>("quickFixFilters") ?? [];
        settings.regionalizeInterfaceImplementations = settings.get<string[]>("regionalizeInterfaceImplementations") ?? [];
        settings.removeUnusedUsingsOnSharpen = settings.get<boolean>("removeUnusedUsingsOnSharpen") ?? true;
        settings.showFileSizeDifferenceOnSharpen = settings.get<boolean>("showFileSizeDifferenceOnSharpen") ?? false;

        if (settings.regionalizeInterfaceImplementations.includes("*")) {
            settings.regionalizeInterfaceImplementations = [...new Set(CSharpenVSCodeExtensionSettings.regionalizableInterfaceImplementations.concat(...CSharpenVSCodeExtensionSettings.regionalizableGenericInterfaceImplementations))];
        }
        else if (settings.regionalizeInterfaceImplementations.length > 0) {
            if (settings.regionalizeInterfaceImplementations.includes("IList")) settings.regionalizeInterfaceImplementations = [...new Set(settings.regionalizeInterfaceImplementations.concat(...["ICollection", "IEnumerable"]))];
            else if (settings.regionalizeInterfaceImplementations.includes("ICollection")) settings.regionalizeInterfaceImplementations = [...new Set(settings.regionalizeInterfaceImplementations.concat(...["IEnumerable"]))];
        }

        if (settings.regionalizeInterfaceImplementations.includes("IDisposable") && settings.regionalizeInterfaceImplementations.includes("IAsyncDisposable")) {
            settings.regionalizeInterfaceImplementations.splice(settings.regionalizeInterfaceImplementations.indexOf("IAsyncDisposable"), 1); // IAsyncDisposable is covered by IDisposable
        }

        CSharpenVSCodeExtensionSettings.assignFromConfiguration(settings.namespaceLevelOrganization, settings.get<CSharpOrganizeSettings>("namespaceLevelOrganization"));
        CSharpenVSCodeExtensionSettings.assignFromConfiguration(settings.typeLevelOrganization, settings.get<CSharpOrganizeSettings>("typeLevelOrganization"));
    }
}
