import * as fs from "fs/promises";
import * as vscode from 'vscode';
import path from 'path';

export class FileSystem {
    static async exists(path: string): Promise<boolean> {
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

    static async readFile(filePath: string): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            if (!await this.exists(filePath)) { reject(new Error(`File not found: ${filePath}`)); return; }

            await fs.readFile(filePath).then(data => {
                resolve(Buffer.from(data).toString("utf8"));
            }, err => {
                reject(err);
            });
        });
    }
}
