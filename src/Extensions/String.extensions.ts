declare global {
    interface String {
        equalsAny(values: string[], prefix?: string, suffix?: string): string | undefined;

        indexOfMatch(regex: string | RegExp, position?: number | undefined): number;

        startsWithAny(values: string[], prefix?: string, suffix?: string): string | undefined;

        /** Trims leading and trailing empty lines. */
        trimEmptyLines(): string;

        trimEndLine(): string;

        trimLeading(string: string, count?: number): String;

        /** Trims leading empty lines. */
        trimLeadingEmptyLines(): string;

        trimStartLine(): string;

        /** Trims trailing empty lines. */
        trimTrailingEmptyLines(): string;
    }
};

String.prototype.equalsAny = function (values: string[], prefix = "", suffix = ""): string | undefined {
    return values.find(value => this === prefix + value + suffix);
};

String.prototype.indexOfMatch = function (regex: string | RegExp, position?: number | undefined): number {
    position ??= 0;

    const re = typeof regex === "string" ? new RegExp(regex) : regex;
    re.lastIndex = 0;

    const match = re.exec(this.substring(position));
    return match ? match.index + position : -1;
};

String.prototype.startsWithAny = function (values: string[], prefix = "", suffix = ""): string | undefined {
    return values.find(value => this.startsWith(prefix + value + suffix));
};

String.prototype.trimEmptyLines = function (): string {
    return this
        .replace(/^\s*[\r\n]+/, "") // Leading empty lines
        .replace(/[\r\n]+\s*$/, ""); // Trailing empty lines
};

String.prototype.trimLeading = function (string: string, count = -1): String {
    let i = 0;
    const l = string.length;
    while (string.substring(i, i + l) === string && (i < count || count === -1)) i += l;
    return string.substring(i);
};

String.prototype.trimLeadingEmptyLines = function (): string {
    return this.replace(/^\s*[\r\n]+/, ""); // Leading empty lines
};

String.prototype.trimTrailingEmptyLines = function (): string {
    return this.replace(/[\r\n]+\s*$/, ""); // Trailing empty lines
};

String.prototype.trimEndLine = function (): string {
    return this.replace(/\r?\n[ \t]*$/, "");
};

String.prototype.trimStartLine = function (): string {
    return this.replace(/^[ \t]*\r?\n/, "");
};

export { };
