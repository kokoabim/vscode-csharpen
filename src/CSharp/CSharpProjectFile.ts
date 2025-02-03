import * as vscode from "vscode";
import * as fs from "fs/promises";
import { glob } from 'glob';
import { basename, dirname } from 'path';
import { Executor } from "../Utils/Executor";

export class CSharpProjectFile {
    assemblyName!: string;
    defaultNamespace!: string;
    directory: string;
    isTestProject = false;
    name: string;
    packageReferences: CSharpProjectPackageReference[] = [];
    projectReferences: CSharpProjectProjectReference[] = [];
    removedPackageReferences: CSharpProjectPackageReference[] = [];
    removedProjectReferences: CSharpProjectProjectReference[] = [];
    solutionFilePath: string | undefined;
    targetFramework: string | undefined;
    workspaceFolder: string | undefined;

    private fileContents: string | undefined;

    constructor(public filePath: string, public relativePath: string) {
        this.directory = dirname(filePath);
        this.name = basename(filePath, ".csproj");
        this.relativePath = relativePath;
    }

    static async findProjectsAsync(workspaceFolder: vscode.WorkspaceFolder): Promise<CSharpProjectFile[]> {
        return await CSharpProjectFile.findProjectsUnderDirectoryAsync(workspaceFolder.uri.fsPath, true);
    }

    static async findProjectsUnderDirectoryAsync(directory: string, isWorkspaceFolder = false): Promise<CSharpProjectFile[]> {
        return await glob(directory + '/**/*.csproj').then(async files => {
            const cSharpProjectFiles = files.map(f => {
                const projectFile = new CSharpProjectFile(f, f.replace(directory + "/", ""));
                if (isWorkspaceFolder) projectFile.workspaceFolder = directory;
                return projectFile;
            });
            for await (const f of cSharpProjectFiles) { await f.readFilePropertiesAsync(); }
            return cSharpProjectFiles;
        }, error => {
            throw error;
        });
    }

    static projectOfTextDocument(projects: CSharpProjectFile[], textDocument: vscode.TextDocument): CSharpProjectFile | undefined {
        return projects.find(p => textDocument.uri.path.includes(p.directory + "/"));
    }

    async buildAsync(outputChannel: vscode.OutputChannel, prefix = "", showFilePath = true): Promise<boolean> {
        outputChannel.append(`${prefix}${showFilePath ? `[Project: ${this.name}] ` : ""}Building project...`);


        // eslint-disable-next-line no-unused-vars
        const [dotNetBuildExitCode, dotNetBuildOutput] = await Executor.execToString(`dotnet build -v m "${this.filePath}"`, this.directory);
        if (dotNetBuildExitCode === 0) {
            outputChannel.appendLine(" succeeded");
            return true;
        }
        else {
            outputChannel.appendLine(" failed");
            return false;
        }
    }

    async buildSolutionAsync(outputChannel: vscode.OutputChannel, prefix = "", showFilePath = true): Promise<boolean> {
        if (!this.solutionFilePath) {
            outputChannel.appendLine(`${prefix}No solution file found`);
            return false;
        }

        outputChannel.append(`${prefix}${showFilePath ? `[Solution: ${basename(this.solutionFilePath, ".sln")}] ` : ""}Building solution...`);

        // eslint-disable-next-line no-unused-vars
        const [dotNetBuildExitCode, dotNetBuildOutput] = await Executor.execToString(`dotnet build -v m "${this.solutionFilePath}"`, this.workspaceFolder!);
        if (dotNetBuildExitCode === 0) {
            outputChannel.appendLine(` succeeded`);
            return true;
        }
        else {
            outputChannel.appendLine(` failed ❌`);
            return false;
        }
    }

    private async getSolutionFilePath(): Promise<string | undefined> {
        if (!this.workspaceFolder) return undefined;

        const solutionFilePaths = await glob(this.workspaceFolder + '/*.sln');
        if (solutionFilePaths.length === 0) return undefined;

        for await (const solutionFilePath of solutionFilePaths) {
            const solutionContents = await CSharpProjectFile.readFileAsStringAsync(solutionFilePath);
            if (solutionContents.includes("\"" + this.relativePath.replace(/\//g, "\\") + "\"")) return solutionFilePath;
        }

        return undefined;
    }

    async getCSharpFileUris(): Promise<vscode.Uri[]> {
        return await this.getFileUrisByExtension("cs");
    }

    async getFileUrisByExtension(extension: string): Promise<vscode.Uri[]> {
        return (await vscode.workspace.findFiles(`**/*.${extension}`)).filter(f =>
            f.path.includes(this.directory + "/")
            && !f.path.includes("/bin/Debug/")
            && !f.path.includes("/obj/Debug/")
            && !f.path.includes("/bin/Release/")
            && !f.path.includes("/obj/Release/")
        );
    }

    getProperty(name: string): string | undefined {
        return this.fileContents?.match(new RegExp(`<${name}>(.*)</${name}>`, "i"))?.[1];
    }

    async removePackageReferenceAsync(outputChannel: vscode.OutputChannel, reference: CSharpProjectPackageReference): Promise<boolean> {
        outputChannel.append(`\n[Project: ${this.name}, Package: ${reference.name}] Removing package reference...`);

        if (this.packageReferences.find(r => r.name === reference.name) === undefined) {
            outputChannel.appendLine(" not found");
            return false;
        }

        // eslint-disable-next-line no-unused-vars
        const [dotNetRemoveExitCode, dotNetRemoveOutput] = await Executor.execToString(`dotnet remove "${this.filePath}" package ${reference.name}`, this.directory);
        if (dotNetRemoveExitCode !== 0) {
            outputChannel.appendLine(" failed ❌");
            return false;
        }
        else {
            outputChannel.appendLine(" succeeded");
        }

        const didBuildSolution = await this.buildSolutionAsync(outputChannel, " - ", false);
        if (didBuildSolution) {
            outputChannel.appendLine(" - Package reference removed ✅");

            this.packageReferences = this.packageReferences.filter(r => r.name !== reference.name);
            this.removedPackageReferences.push(reference);
            this.removedPackageReferences = this.removedPackageReferences.sort((a, b) => a.name.localeCompare(b.name));

            return true;
        }

        outputChannel.append(" - Re-adding package reference...");
        // eslint-disable-next-line no-unused-vars
        const [dotNetAddExitCode, dotNetAddOutput] = await Executor.execToString(`dotnet add "${this.filePath}" package ${reference.name} --version ${reference.version}`, this.directory);
        if (dotNetAddExitCode === 0) outputChannel.appendLine(" succeeded");
        else outputChannel.appendLine(" failed ❌");

        return false;
    }

    // TODO: resolve issue with removing project references
    /*async removeProjectReferenceAsync(outputChannel: vscode.OutputChannel, reference: CSharpProjectProjectReference): Promise<boolean> {
        outputChannel.append(`\n[Project: ${this.name}, Project: ${reference.name}] Removing project reference...`);

        if (this.projectReferences.find(r => r.path === reference.path) === undefined) {
            outputChannel.appendLine(" not found");
            return false;
        }

        // eslint-disable-next-line no-unused-vars
        const [dotNetRemoveExitCode, dotNetRemoveOutput] = await Executor.execToString(`dotnet remove "${this.filePath}" reference "${reference.path}"`, this.directory);
        if (dotNetRemoveExitCode !== 0) {
            outputChannel.appendLine(" failed ❌");
            return false;
        }
        else {
            outputChannel.appendLine(" succeeded");
        }

        const didBuild = await this.buildSolutionAsync(outputChannel, " - ", false);
        if (didBuild) {
            outputChannel.appendLine(" - Project reference removed ✅");

            this.projectReferences = this.projectReferences.filter(r => r.path !== reference.path);
            this.removedProjectReferences.push(reference);
            this.removedProjectReferences = this.removedProjectReferences.sort((a, b) => a.path.localeCompare(b.path));

            return true;
        }

        outputChannel.append(" - Re-adding project reference...");
        // eslint-disable-next-line no-unused-vars
        const [dotNetAddExitCode, dotNetAddOutput] = await Executor.execToString(`dotnet add "${this.filePath}" reference "${reference.path}"`, this.directory);
        if (dotNetAddExitCode === 0) outputChannel.appendLine(" succeeded");
        else outputChannel.appendLine(" failed ❌");

        return false;
    }*/

    private static async readFileAsStringAsync(filePath: string): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            await fs.readFile(filePath).then(data => {
                resolve(Buffer.from(<Uint8Array>data).toString("utf8"));
            }, err => {
                reject(err);
            });
        });
    }

    private async readFilePropertiesAsync(): Promise<void> {
        await CSharpProjectFile.readFileAsStringAsync(this.filePath).then(contents => {
            this.fileContents = contents;
        }, error => {
            throw error;
        });

        this.assemblyName = this.name;

        this.solutionFilePath = await this.getSolutionFilePath();

        if (this.fileContents) {
            const assemblyName = this.getProperty("AssemblyName");
            if (assemblyName) this.assemblyName = assemblyName;

            this.defaultNamespace = this.getProperty("RootNamespace") || assemblyName || this.name || "";
            this.isTestProject = this.getProperty("IsTestProject")?.localeCompare("true", undefined, { sensitivity: "accent" }) === 0;
            this.targetFramework = this.getProperty("TargetFramework");

            let m;

            CSharpProjectPackageReference.regExp.lastIndex = 0;
            while ((m = CSharpProjectPackageReference.regExp.exec(this.fileContents)) !== null) {
                if (m.groups) this.packageReferences.push(new CSharpProjectPackageReference(m[0], m.groups.name, m.groups.version));
            }
            if (this.packageReferences.length > 0) this.packageReferences = this.packageReferences.sort((a, b) => a.name.localeCompare(b.name));

            CSharpProjectProjectReference.regExp.lastIndex = 0;
            while ((m = CSharpProjectProjectReference.regExp.exec(this.fileContents)) !== null) {
                if (m.groups) this.projectReferences.push(new CSharpProjectProjectReference(m[0], m.groups.path));
            }
            if (this.projectReferences.length > 0) this.projectReferences = this.projectReferences.sort((a, b) => a.path.localeCompare(b.path));
        }
    }
}

export class CSharpProjectPackageReference {
    static readonly regExp = /(^[ \t]*)?<PackageReference\s+Include="(?<name>[^"]*)"\s+Version="(?<version>[^"]*)"([^>]*?\/>|.*<\/PackageReference>)([ \t]*$)?/gs;

    constructor(public readonly match: string, public readonly name: string, public readonly version: string) { }
}

export class CSharpProjectProjectReference {
    static readonly regExp = /(^[ \t]*)?<ProjectReference\s+Include="(?<path>[^"]*)"([^>]*?\/>|.*<\/ProjectReference>)([ \t]*$)?/gs;

    readonly name: string;

    constructor(public readonly match: string, public readonly path: string) {
        this.name = basename(path, ".csproj");
    }
}
