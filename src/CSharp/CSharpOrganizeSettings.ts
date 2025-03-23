export class CSharpOrganizeSettings {
    public doNotRegionalizeMembersOf: string[] = [];
    public doNotRegionalizeTypes: string[] = [];
    public onlyRegionalizeMembersOf: string[] = [];
    public onlyRegionalizeTypes: string[] = [];
    public ordering: string[] = [];
    public regionThreshold = 5;
    public regionalization: string[] = [];
    public typeSort: string[] = [];

    public static get defaultNamespaceLevelOrganization(): CSharpOrganizeSettings {
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

    public static get defaultTypeLevelOrganization(): CSharpOrganizeSettings {
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

    public static filterTypeSort(typeSort: string[]): string[] {
        if (typeSort.includes("using")) typeSort = typeSort.filter(t => t !== "using");
        if (typeSort.includes("namespace")) typeSort = typeSort.filter(t => t !== "namespace");
        return typeSort;
    }
}
