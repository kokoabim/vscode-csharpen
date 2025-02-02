import * as fs from "fs/promises";
import * as vscode from 'vscode';
import path from 'path';

export class FileSystem {
    static async existsAsync(path: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            await fs.access(path, fs.constants.F_OK).then(() => {
                resolve(true);
            }, err => {
                if (err.code === 'ENOENT') { resolve(false); return; }
                reject(err);
            });
        });
    }

    static fileNameUsingTextDocument(document: vscode.TextDocument, withExtension = true): string {
        return path.basename(document.fileName, withExtension ? undefined : path.extname(document.fileName));
    }

    static fileNameUsingUri(uri: vscode.Uri, withExtension = true): string {
        return path.basename(uri.fsPath, withExtension ? undefined : path.extname(uri.fsPath));
    }

    static async makeDirAsync(thePath: string, pathIsfile = false): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (pathIsfile) { thePath = path.dirname(thePath); }
            await fs.mkdir(thePath, { recursive: true }).then(() => resolve(), err => reject(err));
        });
    }

    static async readFileAsync(filePath: string): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            if (!await this.existsAsync(filePath)) { reject(new Error(`File not found: ${filePath}`)); return; }

            await fs.readFile(filePath).then(data => {
                resolve(Buffer.from(data).toString("utf8"));
            }, err => {
                reject(err);
            });
        });
    }

    static async writeFileAsync(filePath: string, dataOrObject: any, overwrite = false, includeNullUndefinedOnStringify = true): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (!overwrite && (await FileSystem.existsAsync(filePath))) { reject(`File already exists: ${filePath}`); return; }

            const data = typeof dataOrObject === "string" ? dataOrObject : JSON.stringify(dataOrObject, (key, val) => {
                if (includeNullUndefinedOnStringify || (val !== null && val !== undefined)) { return val; }
            }, 4);

            const dirName = path.dirname(filePath);
            if (!(await FileSystem.existsAsync(dirName))) await FileSystem.makeDirAsync(dirName);

            await fs.writeFile(filePath, data).then(() => {
                resolve();
            }, err => {
                reject(err);
            });
        });
    }
}
