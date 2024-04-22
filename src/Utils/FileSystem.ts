import path from 'path';
import * as vscode from 'vscode';

export class FileSystem {
    static fileName(document: vscode.TextDocument, withExtension = true): string {
        return path.basename(document.fileName, withExtension ? undefined : path.extname(document.fileName));
    }
}