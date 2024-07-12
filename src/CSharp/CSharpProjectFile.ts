import { basename, dirname } from 'path';
import { glob } from 'glob';
import { FileSystem } from '../Utils/FileSystem';

export class CSharpProjectFile {
    private _fileContent: string | undefined;

    constructor(
        public readonly name: string,
        public readonly filePath: string,
        public readonly relativePath: string) { }

    get directory(): string { return dirname(this.filePath); }

    get isTestProject(): boolean { return this._fileContent !== undefined && this._fileContent?.includes('<IsTestProject>true</IsTestProject>'); }

    static async findProjects(workspaceDirectory: string): Promise<CSharpProjectFile[]> {
        return await glob(workspaceDirectory + '/**/*.csproj').then(async files => {
            const cSharpProjectFiles = files.map(f => new CSharpProjectFile(basename(f, ".csproj"), f, f.replace(workspaceDirectory + "/", "")));
            for await (const f of cSharpProjectFiles) { await f.readFile(); }
            return cSharpProjectFiles;
        }, error => {
            throw error;
        });
    }

    async readFile(): Promise<void> {
        if (this._fileContent) { return; }
        await FileSystem.readFile(this.filePath).then(content => {
            this._fileContent = content;
        }, error => {
            throw error;
        });
    }
}
