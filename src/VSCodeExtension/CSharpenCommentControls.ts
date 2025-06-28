export class CSharpenCommentControls {
    static readonly commentPrefix = "//[\\t ]*csharpen:[\\t ]*";
    static readonly doNotRemove = "do-not-remove";
    static readonly doNotRemoveRegex = new RegExp(`${CSharpenCommentControls.commentPrefix}${CSharpenCommentControls.doNotRemove}[\\t ]*$`, "i");

    static hasDoNotRemove(line: string): boolean {
        if (!line) return false;
        CSharpenCommentControls.doNotRemoveRegex.lastIndex = 0;
        return CSharpenCommentControls.doNotRemoveRegex.test(line);
    }
}