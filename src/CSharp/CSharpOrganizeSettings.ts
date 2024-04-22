export class CSharpOrganizeSettings {
    doNotRegionalizeMembersOf: string[] = [];
    doNotRegionalizeTypes: string[] = [];
    onlyRegionalizeMembersOf: string[] = [];
    onlyRegionalizeTypes: string[] = [];
    ordering: string[] = [];
    regionThreshold = 0;
    regionalization: string[] = [];
    typeSort: string[] = [];

    static filterTypeSort(typeSort: string[]): string[] {
        if (typeSort.includes("using")) typeSort = typeSort.filter(t => t !== "using");
        if (typeSort.includes("namespace")) typeSort = typeSort.filter(t => t !== "namespace");
        return typeSort;
    }
}
