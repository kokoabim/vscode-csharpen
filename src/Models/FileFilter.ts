
export class FileFilter {
    confirmOnDeny = false;
    fileName?: string;
    matchLogic = true;
    name!: string;
    pattern!: string;
    reason?: string;

    constructor(init: Partial<FileFilter>) {
        Object.assign(this, init);
    }

    get ignoredReason() { return this.reason ? this.reason : `File filter: ${this.name}`; }

    static checkAll(fileName: string, content: string, fileFilters: FileFilter[]): [FileFilterStatus, string | undefined] {
        for (const ff of fileFilters) {
            const check = ff.check(fileName, content);
            if (check !== FileFilterStatus.allow) return [check, ff.ignoredReason];
        }

        return [FileFilterStatus.allow, undefined];
    }

    check(fileName: string, content: string): FileFilterStatus {
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

export enum FileFilterStatus {
    allow,
    deny,
    confirm
}
