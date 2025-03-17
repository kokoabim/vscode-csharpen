import "../Extensions/Array.extensions";

import { RegionGroup } from "../Models/RegionGroup";
import { CSharpenVSCodeExtensionSettings } from "../VSCodeExtension/CSharpenVSCodeExtensionSettings";
import { CSharpAccessModifier } from "./CSharpAccessModifier";
import { CSharpFile } from "./CSharpFile";
import { CSharpOrganizeSettings } from "./CSharpOrganizeSettings";
import { CSharpSymbol } from "./CSharpSymbol";
import { CSharpSymbolLevel } from "./CSharpSymbolLevel";
import { CSharpSymbolType } from "./CSharpSymbolType";
import { CSharpType } from "./CSharpType";

export class CSharpOrganizer {
    public static organizeFile(settings: CSharpenVSCodeExtensionSettings, file: CSharpFile): void {
        file.children = CSharpOrganizer.organizeSymbols(settings, file.children, undefined);
    }

    private static flattenOrganizedMaps(organizeSettings: CSharpOrganizeSettings, orderingMaps: Map<any, any>): CSharpSymbol[] {
        let organizedSymbols: any[] = [];

        for (let i = 0; i < organizeSettings.ordering.length; i++) {
            organizedSymbols = i === 0
                ? [...orderingMaps.values()].flat()
                : organizedSymbols.flatMap(m => [...m.values()]);
        }

        return organizedSymbols.flatMap(m => m);
    }

    private static organizeSymbols(settings: CSharpenVSCodeExtensionSettings, symbols: CSharpSymbol[], parent: CSharpSymbol | undefined, symbolLevel = CSharpSymbolLevel.namespace): CSharpSymbol[] {
        let result = [...symbols];

        const organization = symbolLevel === CSharpSymbolLevel.namespace ? settings.namespaceLevelOrganization : settings.typeLevelOrganization;
        if (organization.ordering.length === 0 || organization.typeSort.length === 0) return result;

        const usingAndNamespaceSymbols = CSharpOrganizer.removeUsingAndNamespaceSymbols(result);

        if (result.length > 0) {
            const organizedMaps = CSharpOrganizer.toOrganizedMaps(organization, result);
            if (organizedMaps && organizedMaps.size > 0) result = CSharpOrganizer.flattenOrganizedMaps(organization, organizedMaps).filter(s => s.type !== CSharpSymbolType.primaryConstructor);
        }

        result.unshift(...usingAndNamespaceSymbols);
        CSharpOrganizer.regionalizeImplementations(settings, result);
        CSharpOrganizer.regionalizeSymbols(settings, parent, result, symbolLevel);

        CSharpOrganizer.recursivelyOrganizeChildren(settings, result);
        return result;
    }

    private static recursivelyOrganizeChildren(settings: CSharpenVSCodeExtensionSettings, symbols: CSharpSymbol[]): void {
        symbols.forEach(symbol => {
            if (symbol.hasChildren) symbol.children = CSharpOrganizer.organizeSymbols(settings, symbol.children, symbol, !symbol.parent || symbol.type <= CSharpSymbolType.namespace ? CSharpSymbolLevel.namespace : CSharpSymbolLevel.type);
        });
    }

    private static regionalizeImplementations(settings: CSharpenVSCodeExtensionSettings, symbols: CSharpSymbol[]): void {
        if (settings.regionalizeInterfaceImplementations.length === 0) return;

        const classes = symbols.filter(s => s.type === CSharpSymbolType.class && s.hasChildren && s.implements.length > 0);
        if (classes.length === 0) return;

        for (const c of classes) {
            const interfacesRegionalized: string[] = [];

            for (const i of settings.regionalizeInterfaceImplementations) {
                if (/* non-generic */((CSharpenVSCodeExtensionSettings.regionalizableInterfaceImplementations.includes(i)) && c.doesImplement(i, false, symbols))
                    ||
                    /* generic */ ((CSharpenVSCodeExtensionSettings.regionalizableGenericInterfaceImplementations.includes(i)) && c.doesImplement(i, true, symbols))
                ) {
                    CSharpOrganizer.regionalizeInterface(i, c, interfacesRegionalized);
                }
            }
        }
    }

    private static regionalizeInterface(interfaceName: string, symbol: CSharpSymbol, interfacesRegionalized: string[], regionName?: string): void {
        if (interfacesRegionalized.includes(interfaceName) || (interfaceName.match(/^I(Async)?Disposable$/) && interfacesRegionalized.anyMatches(/^I(Async)?Disposable$/))) return;
        interfacesRegionalized.push(interfaceName);

        const regionSymbols: CSharpSymbol[] = [];

        if (interfaceName.match(/^I(Async)?Disposable$/)) {
            regionName ??= interfaceName;

            const field = symbol.children.filter(s => s.type === CSharpSymbolType.field && s.name.match(/^_?(is)?disposed$/i) && CSharpType.fromString(s.returnType) === CSharpType.bool);
            if (field.length === 1) regionSymbols.push(field[0]);

            const finalizer = symbol.children.find(s => s.type === CSharpSymbolType.finalizer);
            if (finalizer) regionSymbols.push(finalizer);

            const methods = symbol.children.filter(s => s.type === CSharpSymbolType.method && s.name.match(/^((.*?\.)?I(Async)?Disposable\.)?Dispose(Async)?$/));
            if (methods.length > 0) regionSymbols.push(...methods);
        }
        else if (interfaceName === "ICollection") {
            regionName ??= interfaceName;

            const properties = symbol.children.filter(s => s.type === CSharpSymbolType.property && s.name.match(/^((.*?\.)?ICollection(<.*?>)?\.)?(Count|IsReadOnly|IsSynchronized|SyncRoot)$/));
            if (properties.length > 0) regionSymbols.push(...properties);

            const methods = symbol.children.filter(s => s.type === CSharpSymbolType.method && s.name.match(/^((.*?\.)?ICollection(<.*?>)?\.)?(Add|Clear|Contains|CopyTo|Remove)$/));
            if (methods.length > 0) regionSymbols.push(...methods);

            // this interface implements...
            CSharpOrganizer.regionalizeInterface("IEnumerable", symbol, interfacesRegionalized, regionName);
        }
        else if (interfaceName === "IConvertible") {
            regionName ??= interfaceName;

            const methods = symbol.children.filter(s => s.type === CSharpSymbolType.method && s.name.match(/^((.*?\.)?IConvertible\.)?(GetTypeCode|To(Boolean|Byte|Char|DateTime|Decimal|Double|Int16|Int32|Int64|SByte|Single|String|Type|UInt16|UInt32|UInt64))$/));
            if (methods.length > 0) regionSymbols.push(...methods);
        }
        else if (interfaceName === "IList") {
            regionName ??= interfaceName;

            const properties = symbol.children.filter(s => s.type === CSharpSymbolType.property && s.name.match(/^((.*?\.)?IList(<.*?>)?\.)?(IsFixedSize|IsReadOnly)$/));
            if (properties.length > 0) regionSymbols.push(...properties);

            const indexers = symbol.children.filter(s => s.type === CSharpSymbolType.indexer);
            if (indexers.length > 0) regionSymbols.push(...indexers);

            const methods = symbol.children.filter(s => s.type === CSharpSymbolType.method && s.name.match(/^((.*?\.)?IList(<.*?>)?\.)?(Add|Clear|Contains|IndexOf|Insert|Remove|RemoveAt)$/));
            if (methods.length > 0) regionSymbols.push(...methods);

            // this interface implements...
            CSharpOrganizer.regionalizeInterface("ICollection", symbol, interfacesRegionalized, regionName);
        }
        else {
            if (interfaceName === "ICloneable") {
                const method = symbol.children.find(s => s.type === CSharpSymbolType.method && s.name.match(/^((.*?\.)?ICloneable\.)?Clone$/));
                if (method) regionSymbols.push(method);
            }
            else if (interfaceName === "IComparable") {
                const methods = symbol.children.filter(s => s.type === CSharpSymbolType.method && s.name.match(/^((.*?\.)?IComparable(<.*?>)?\.)?CompareTo$/));
                if (methods.length > 0) regionSymbols.push(...methods);
            }
            else if (interfaceName === "IEnumerable") {
                const methods = symbol.children.filter(s => s.type === CSharpSymbolType.method && s.name.match(/^((.*?\.)?IEnumerable(<.*?>)?\.)?GetEnumerator$/));
                if (methods.length > 0) regionSymbols.push(...methods);
            }
            else if (interfaceName === "IEqualityComparer") {
                const methods = symbol.children.filter(s => s.type === CSharpSymbolType.method && s.name.match(/^((.*?\.)?IEqualityComparer(<.*?>)?\.)?(Equals|GetHashCode)$/));
                if (methods.length > 0) regionSymbols.push(...methods);
            }
            else if (interfaceName === "IEquatable") {
                const method = symbol.children.find(s => s.type === CSharpSymbolType.method && s.name.match(/^((.*?\.)?IEquatable(<.*?>)?\.)?Equals$/));
                if (method) regionSymbols.push(method);
            }
            else if (interfaceName === "IFormattable") {
                const method = symbol.children.find(s => s.type === CSharpSymbolType.method && s.name.match(/^((.*?\.)?IFormattable\.)?ToString$/));
                if (method) regionSymbols.push(method);
            }

            regionName ??= "interfaces"; // in this else-block, all interfaces share a region, unless 'regionName' has been specified
        }

        if (regionSymbols.length > 0) {
            let regionGroup = symbol.regions.groups.filter(g => g.name === regionName)[0];
            if (!regionGroup) {
                regionGroup = new RegionGroup(regionName);
                symbol.regions.groups.push(regionGroup);
            }
            else {
                regionGroup.symbols.forEach(s => {
                    s.regions.start = undefined;
                    s.regions.end = undefined;
                });
            }

            regionGroup.symbols.push(...regionSymbols);
            regionGroup.symbols[0].regions.start = regionName;
            regionGroup.symbols[regionGroup.symbols.length - 1].regions.end = "";
        }
    }

    private static regionalizeSymbols(settings: CSharpenVSCodeExtensionSettings, parent: CSharpSymbol | undefined, symbols: CSharpSymbol[], symbolLevel: CSharpSymbolLevel): void {
        let isRegionOpen = false;
        let previousRegion = "";
        let previousSymbol: CSharpSymbol | undefined = undefined;
        let regionOpenedSymbol: CSharpSymbol | undefined = undefined;
        let regionalizedSymbolsCount = 0;
        let organization: CSharpOrganizeSettings;
        const parentHasRegionGroups = parent && parent.regions.groups.length > 0;

        if (parentHasRegionGroups) parent.regions.groups.flatMap(g => g.symbols).forEach(s => symbols.splice(symbols.indexOf(s), 1));

        for (let i = 0; i < symbols.length; i++) {
            const currentSymbol = symbols[i];
            if (currentSymbol.type === CSharpSymbolType.using || currentSymbol.type === CSharpSymbolType.namespace) continue;

            organization = symbolLevel === CSharpSymbolLevel.namespace
                ? settings.namespaceLevelOrganization
                : settings.typeLevelOrganization;

            if (organization.regionalization.length === 0) continue;
            else if (organization.doNotRegionalizeTypes.includes(CSharpSymbolType.toString(currentSymbol.type))) continue;
            else if (currentSymbol.parent && organization.doNotRegionalizeMembersOf.includes(CSharpSymbolType.toString(currentSymbol.parent.type))) continue;
            else if (organization.onlyRegionalizeTypes.length > 0 && !organization.onlyRegionalizeTypes.includes(CSharpSymbolType.toString(currentSymbol.type))) continue;
            else if (currentSymbol.parent && organization.onlyRegionalizeMembersOf.length > 0 && !organization.onlyRegionalizeMembersOf.includes(CSharpSymbolType.toString(currentSymbol.parent.type))) continue;

            let currentRegion = "";
            if (organization.regionalization.includes("access")) currentRegion += " " + CSharpAccessModifier.toString(currentSymbol.accessModifier);
            if (organization.regionalization.includes("type")) currentRegion += " " + CSharpSymbolType.toPluralString(currentSymbol.type);
            currentRegion = currentRegion.trim();

            if (currentRegion !== previousRegion) {
                if (isRegionOpen) {
                    if (previousSymbol) closeOrRemoveRegion(organization);

                    isRegionOpen = false;
                    regionalizedSymbolsCount = 0;
                }

                currentSymbol.regions.start = currentRegion;
                regionOpenedSymbol = currentSymbol;
                previousRegion = currentRegion;
                isRegionOpen = true;
            }

            if (isRegionOpen) regionalizedSymbolsCount++;

            previousSymbol = currentSymbol;
        }

        if (isRegionOpen && previousSymbol) closeOrRemoveRegion(organization!);

        if (parentHasRegionGroups) parent.regions.groups.forEach(g => symbols.push(...g.symbols));

        function closeOrRemoveRegion(organization: CSharpOrganizeSettings) {
            if (regionalizedSymbolsCount > organization.regionThreshold) {
                previousSymbol!.regions.end = "";
            }
            else {
                if (regionOpenedSymbol) {
                    regionOpenedSymbol.regions.start = undefined;
                    regionOpenedSymbol = undefined;
                }
                previousSymbol!.regions.end = undefined;
            }
        }
    }

    private static removeUsingAndNamespaceSymbols(symbols: CSharpSymbol[]): CSharpSymbol[] {
        const namespaceSymbols = symbols.filter(s => s.type === CSharpSymbolType.namespace).sort((a, b) => a.name.localeCompare(b.name));
        if (namespaceSymbols.length > 1 && namespaceSymbols.length !== namespaceSymbols.filter(s => !s.data.isFileScoped).length) {
            throw new Error("If multiple namespace declarations exist, all must have bodies and none can be file-scoped.");
        }

        const usingAndNamespaceSymbols = symbols
            .filter(s => s.type === CSharpSymbolType.using).sort((a, b) => a.name.localeCompare(b.name))
            .concat(namespaceSymbols);

        usingAndNamespaceSymbols.forEach(symbol => {
            symbols.splice(symbols.indexOf(symbol), 1);
        });

        return usingAndNamespaceSymbols;
    }

    private static toAccessModifierMap(symbols: CSharpSymbol[]): Map<CSharpAccessModifier, CSharpSymbol[]> {
        return new Map([...symbols.groupBy("accessModifier")].sort((a, b) => a[0] - b[0]));
    }

    private static toNameMap(symbols: CSharpSymbol[]): Map<string, CSharpSymbol[]> {
        return new Map([...symbols.sort((a, b) => a.name.localeCompare(b.name)).groupBy("name")]);
    }

    private static toOrderMap(organizeSettings: CSharpOrganizeSettings, order: string, symbols: CSharpSymbol[]): Map<any, CSharpSymbol[]> | undefined {
        if (order === "access") {
            return CSharpOrganizer.toAccessModifierMap(symbols);
        } else if (order === "name") {
            return CSharpOrganizer.toNameMap(symbols);
        } else if (order === "type") {
            return CSharpOrganizer.toTypeMap(symbols, organizeSettings);
        }
        return undefined;
    }

    private static toOrganizedMaps(organizeSettings: CSharpOrganizeSettings, symbols: CSharpSymbol[]) {
        let orderingMaps: Map<any, any> | undefined = undefined;
        for (let i = 0; i < organizeSettings.ordering.length; i++) {
            const order = organizeSettings.ordering[i];

            if (i === 0) {
                orderingMaps = CSharpOrganizer.toOrderMap(organizeSettings, order, symbols);
            }
            else if (orderingMaps) {
                if (i === 1) {
                    const newMap = new Map();
                    for (const [key, value] of orderingMaps) {
                        newMap.set(key, CSharpOrganizer.toOrderMap(organizeSettings, order, value));
                    }
                    orderingMaps = newMap;
                }
                else {
                    const newMap1 = new Map();
                    for (const [key1, value1] of orderingMaps) {
                        const newMap2 = new Map();
                        for (const [key2, value2] of value1) {
                            newMap2.set(key2, CSharpOrganizer.toOrderMap(organizeSettings, order, value2));
                        }
                        newMap1.set(key1, newMap2);
                    }
                    orderingMaps = newMap1;
                }
            }
        }
        return orderingMaps;
    }

    private static toTypeMap(symbols: CSharpSymbol[], organizeSettings: CSharpOrganizeSettings): Map<CSharpSymbolType, CSharpSymbol[]> {
        return new Map([...symbols.groupBy("type")].sort((a, b) => {
            const aIndex = organizeSettings.typeSort.indexOf(CSharpSymbolType.toString(a[0]));
            const bIndex = organizeSettings.typeSort.indexOf(CSharpSymbolType.toString(b[0]));
            return aIndex !== -1 && bIndex !== -1 ? aIndex - bIndex : 0;
        }));
    }
}
