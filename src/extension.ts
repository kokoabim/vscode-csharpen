import { CSharpenVSCodeExtension } from "./VSCodeExtension/CSharpenVSCodeExtension";
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
    CSharpenVSCodeExtension.use(context);
}

export function deactivate() { }
