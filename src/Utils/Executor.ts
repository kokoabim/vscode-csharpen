import * as vscode from "vscode";
import { exec } from "child_process";
import { StringBuilder } from "./StringBuilder";

export class Executor {
    static async execToOutputChannel(command: string, cwd: string, outputChannel: vscode.OutputChannel): Promise<number | null> {
        let childProcess;
        try {
            childProcess = exec(command, { encoding: "utf8", maxBuffer: 5120000, cwd: cwd });
            childProcess.stdout?.on("data", data => outputChannel.append(String(data)));
            childProcess.stderr?.on("data", data => outputChannel.append(String(data)));
        }
        catch (error) {
            outputChannel.appendLine("Error executing command: " + error);
            return null;
        }

        return new Promise<number | null>(resolve => childProcess.on("close", code => resolve(code)));
    }

    static async execToString(command: string, cwd: string): Promise<[number | null, string]> {
        const sb = new StringBuilder();
        let childProcess;

        try {
            childProcess = exec(command, { encoding: "utf8", maxBuffer: 5120000, cwd: cwd });
            childProcess.stdout?.on("data", data => sb.append(String(data)));
            childProcess.stderr?.on("data", data => sb.append(String(data)));
        }
        catch (error) {
            return [null, "Error executing command: " + error];
        }

        return new Promise<[number | null, string]>(resolve => childProcess.on("close", code => resolve([code, sb.toString()])));
    }
}