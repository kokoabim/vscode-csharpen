export class CSharpOrganizeSettings {
    static get defaultNamespaceLevelOrganization(): CSharpOrganizeSettings {
        return {
            "ordering": [
                "type",
                "access",
                "name"
            ],
            "typeSort": [
                "delegate",
                "interface",
                "class",
                "enum",
                "struct",
                "record",
                "record struct"
            ],
            "regionalization": [
                "type"
            ],
            "regionThreshold": 5,
            "doNotRegionalizeMembersOf": [
                "interface"
            ],
            "onlyRegionalizeMembersOf": [],
            "doNotRegionalizeTypes": [],
            "onlyRegionalizeTypes": [
                "namespace",
                "class"
            ]
        } as CSharpOrganizeSettings;
    }

    static get defaultTypeLevelOrganization(): CSharpOrganizeSettings {
        return {
            "ordering": [
                "type",
                "access",
                "name"
            ],
            "typeSort": [
                "delegate",
                "event",
                "constant",
                "property",
                "field",
                "static constructor",
                "constructor",
                "indexer",
                "finalizer",
                "method",
                "operator",
                "interface",
                "class",
                "enum",
                "struct",
                "record",
                "record struct"
            ],
            "regionalization": [
                "type"
            ],
            "regionThreshold": 5,
            "doNotRegionalizeMembersOf": [
                "interface"
            ],
            "doNotRegionalizeTypes": [],
            "onlyRegionalizeMembersOf": [
                "class"
            ],
            "onlyRegionalizeTypes": [
                "property",
                "field",
                "constant",
                "method"
            ]
        } as CSharpOrganizeSettings;
    }

    doNotRegionalizeMembersOf: string[] = [];
    doNotRegionalizeTypes: string[] = [];
    onlyRegionalizeMembersOf: string[] = [];
    onlyRegionalizeTypes: string[] = [];
    ordering: string[] = [];
    regionThreshold = 5;
    regionalization: string[] = [];
    typeSort: string[] = [];

    static filterTypeSort(typeSort: string[]): string[] {
        if (typeSort.includes("using")) typeSort = typeSort.filter(t => t !== "using");
        if (typeSort.includes("namespace")) typeSort = typeSort.filter(t => t !== "namespace");
        return typeSort;
    }
}
