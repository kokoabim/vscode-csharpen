export enum FileFilterStatus {
    allow,
    deny,
    confirm
}

export class FileFilter {
    public confirmOnDeny = false;
    public fileName?: string;
    public matchLogic = true;
    public name!: string;
    public pattern!: string;
    public reason?: string;

    constructor(init: Partial<FileFilter>) {
        Object.assign(this, init);
    }

    public get ignoredReason(): string { return this.reason ? this.reason : `File filter: ${this.name}`; }

    public static checkAll(fileName: string, content: string, fileFilters: FileFilter[]): [FileFilterStatus, string | undefined] {
        for (const ff of fileFilters) {
            const check = ff.check(fileName, content);
            if (check !== FileFilterStatus.allow) return [check, ff.ignoredReason];
        }

        return [FileFilterStatus.allow, undefined];
    }

    public check(fileName: string, content: string): FileFilterStatus {
        return this.fileNameIsOk(fileName) && this.patternLogicMatchesContent(content)
            ? this.confirmOnDeny ? FileFilterStatus.confirm : FileFilterStatus.deny
            : FileFilterStatus.allow;
    }

    private fileNameIsOk(fileName: string): boolean {
        return !this.fileName || !!fileName.match(this.fileName);
    }

    private patternLogicMatchesContent(content: string): boolean {
        return this.pattern !== undefined && !!content.match(this.pattern) === this.matchLogic;
    }
}
