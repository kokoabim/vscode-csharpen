import { basename } from "path/posix";


export class CSharpProjectProjectReference {
    static readonly regExp = /(^[ \t]*)?<ProjectReference\s+Include="(?<path>[^"]*)"([^>]*?\/>|.*<\/ProjectReference>)([ \t]*$)?/gs;

    public readonly name: string;

    constructor(public readonly match: string, public readonly path: string) {
        this.name = basename(path, ".csproj");
    }
}
