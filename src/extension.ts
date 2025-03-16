/**
 * CSharpen — C# File Organizer VS Code extension
 * by Spencer James — https://swsj.me
 */

import * as vscode from "vscode";
import { CSharpenVSCodeExtension } from "./VSCodeExtension/CSharpenVSCodeExtension";

export function activate(context: vscode.ExtensionContext) {
    CSharpenVSCodeExtension.use(context);
}

export function deactivate() { }
