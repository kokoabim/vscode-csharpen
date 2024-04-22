import * as vscode from "vscode";

export class FileDiagnostic {
    identifier?: string;
    info?: string;
    message: string;
    path: string;
    range: vscode.Range;
    severity: FileDiagnosticSeverity;
    source?: string;

    constructor(path: string, diagnostic: vscode.Diagnostic) {
        this.path = path;

        this.message = diagnostic.message;
        this.range = diagnostic.range;
        this.severity = <number>diagnostic.severity;
        this.source = diagnostic.source;

        if (diagnostic.code) {
            if (typeof diagnostic.code === "string") {
                this.identifier = diagnostic.code;
            }
            else if (typeof diagnostic.code === "number") {
                this.identifier = diagnostic.code.toString();
            }
            else if (typeof diagnostic.code === "object") {
                this.identifier = diagnostic.code.value.toString();
                this.info = diagnostic.code.target.toString();
            }
        }
    }

    get severityText() { return vscode.DiagnosticSeverity[this.severity]; }

    toString() {
        let additionalInfo = "";
        if (this.identifier) additionalInfo += `, ${this.identifier}`;
        if (this.info) additionalInfo += `, ${this.info}`;
        if (additionalInfo) additionalInfo = ` (${additionalInfo.substring(2)})`;

        return `[${this.path}:${this.range.start.line + 1}:${this.range.start.character + 1}] ${this.severityText}: ${this.message}${additionalInfo}`;
    }
}

/* eslint-enable @typescript-eslint/naming-convention */
export class FileDiagnosticIdentifier {
    static readonly useGeneratedRegexAttributeToGenerateRegExpAtCompileTime = "SYSLIB1045";
    static readonly usingDirectiveUnnecessary = "IDE0005";
}

/* eslint-disable @typescript-eslint/naming-convention */
export enum FileDiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3
}
