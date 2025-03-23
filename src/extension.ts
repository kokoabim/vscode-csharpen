/**
 * CSharpen — C# File Organizer VS Code extension
 * by Spencer James — https://swsj.me
 */

import * as vscode from "vscode";
import { CSharpenVSCodeExtension } from "./VSCodeExtension/CSharpenVSCodeExtension";

export function activate(context: vscode.ExtensionContext): void {
    CSharpenVSCodeExtension.use(context);
}

export function deactivate(): void { /* nothing to do here */ }
