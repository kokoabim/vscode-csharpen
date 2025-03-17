declare global {
    // eslint-disable-next-line no-unused-vars
    interface RegExp {
        matches(input: string): RegExpExecArray[];
        matchGroupValues(input: string, groupName: string): string[];
    }
}

RegExp.prototype.matchGroupValues = function (input: string, groupName: string): string[] {
    return this.matches(input).map(match => match.groups?.[groupName]).filter(value => value !== undefined) as string[];
};

RegExp.prototype.matches = function (input: string): RegExpExecArray[] {
    this.lastIndex = 0;
    let matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;
    while ((match = this.exec(input)) !== null) {
        matches.push(match);
    }
    return matches;
};

export { };
