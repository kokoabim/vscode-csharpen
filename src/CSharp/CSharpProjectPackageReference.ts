
export class CSharpProjectPackageReference {
    static readonly regExp = /(^[ \t]*)?<PackageReference\s+Include="(?<name>[^"]*)"\s+Version="(?<version>[^"]*)"([^>]*?\/>|.*<\/PackageReference>)([ \t]*$)?/gs;

    constructor(public readonly match: string, public readonly name: string, public readonly version: string) { }
}
