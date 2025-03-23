import * as vscode from "vscode";

import { ChildProcess, exec } from "child_process";

import { StringBuilder } from "./StringBuilder";

export class Executor {
    public static async execToOutputChannel(command: string, cwd: string, outputChannel: vscode.OutputChannel): Promise<number | null> {
        let childProcess: ChildProcess;
        try {
            childProcess = exec(command, { encoding: "utf8", maxBuffer: 5120000, cwd: cwd });
            childProcess.stdout?.on("data", (data: any) => outputChannel.append(String(data)));
            childProcess.stderr?.on("data", (data: any) => outputChannel.append(String(data)));
        }
        catch (error) {
            outputChannel.appendLine("Error executing command: " + error);
            return null;
        }

        return new Promise<number | null>(resolve => childProcess.on("close", (code: number | PromiseLike<number | null> | null) => resolve(code)));
    }

    public static async execToString(command: string, cwd: string): Promise<[number | null, string]> {
        const sb = new StringBuilder();
        let childProcess: ChildProcess;

        try {
            childProcess = exec(command, { encoding: "utf8", maxBuffer: 5120000, cwd: cwd });
            childProcess.stdout?.on("data", (data: any) => sb.append(String(data)));
            childProcess.stderr?.on("data", (data: any) => sb.append(String(data)));
        }
        catch (error) {
            return [null, "Error executing command: " + error];
        }

        return new Promise<[number | null, string]>(resolve => childProcess.on("close", (code: number | null) => resolve([code, sb.toString()])));
    }
}
