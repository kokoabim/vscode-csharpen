export class CSharpPatterns {
    private static readonly _nullArr = "\\??(\\[\\]\\??)*";

    static readonly name = "[a-zA-Z][a-zA-Z0-9_]+";
    static readonly namespace = `(${CSharpPatterns.name}(\\.${CSharpPatterns.name})*)`;
    static readonly typeWithGen = `${CSharpPatterns.name}(\\<.*?\\>)?`;
    static readonly typeWithGenNullArr = `(${CSharpPatterns.typeWithGen}${CSharpPatterns._nullArr})`;
    static readonly tupleType = `(\\(${CSharpPatterns.typeWithGenNullArr}(,\\s*${CSharpPatterns.typeWithGenNullArr})+\\)${CSharpPatterns._nullArr})`;
    static readonly anyType = `(${CSharpPatterns.typeWithGenNullArr}|${CSharpPatterns.tupleType})`;

    static readonly attributes = `(?<attributes>\\s*\\[.+\\n?)?`;
    static readonly closePreprocessorDirectives = new RegExp("^(?<text>[ \\t]*#[ \\t]*(endif|pragma).*?)\\r?\\n", "gm");
    static readonly implementsRegExp = new RegExp(`\\s*(?<type>${CSharpPatterns.anyType})(\\s*,\\s*)?`, "g");
    static readonly modifiers = "(?<modifiers>(\\s*(new|public|protected|private|internal|protected\\s+internal|private\\s+protected|file|static|extern|virtual|partial|abstract|sealed|override|readonly|unsafe|volatile|async)\\s+)*)?";
    static readonly multiLineCommentRegExp = new RegExp("(?<text>/\\*.*?\\*/)", "gs");
    static readonly namespaceDeclarationFileScopedRegExp = new RegExp(`^(?<declaration>(?<signature>[ \\t]*namespace\\s+(?<namespace>${CSharpPatterns.namespace}))\\s*;\\s*)`, "gm");
    static readonly namespaceDeclarationWithBodyRegExp = new RegExp(`^(?<declaration>(?<signature>[ \\t]*namespace\\s+(?<namespace>${CSharpPatterns.namespace}))\\s*\\{.*?\\}\\s*)`, "gms");
    static readonly nonNewLine = new RegExp("[^\\r\\n]", "g");
    static readonly openPreprocessorDirectives = new RegExp("^(?<text>[ \\t]*#[ \\t]*(if|pragma).*?)\\r?\\n", "gm");
    static readonly singleLineCommentRegExp = new RegExp("^[ \\t]*(?<text>//.*?[\\r\\n]*)$", "gm");
    static readonly symbolTypeKeywords = `(?<keywords>(interface|record(\\s+class)?|class|record(\\s+struct)?|struct|enum))`;
    static readonly symbolTypeOnlyWithReturnTypeFirst = `(?<returnType>${this.anyType})\\s+(?<symbolType>operator)`;
    static readonly symbolTypeOnlyWithReturnTypeLast = `(?<symbolType>\\s*(delegate|event|const|(explicit|implicit)\\s+operator))\\s+(?<returnType>${this.anyType})`;
    static readonly symbolTypeWithReturnTypeKeywords = `(?<keywords>(delegate\\s+${this.anyType}|event\\s+${this.anyType}|const\\s+${this.anyType}|(explicit|implicit)\\s+operator\\s+${this.anyType}|${this.anyType}\\s+operator))`;
    static readonly usingDirectiveRegExp = new RegExp(`^(?<directive>[ \\t]*(?<g>global\\s+)?using\\s+(?<s>static\\s+)?((?<name>${CSharpPatterns.name})\\s*=\\s*)?(?<namespace>${CSharpPatterns.namespace})\\s*;\\s*)`, "gm");
    static readonly xmlCommentRegExp = new RegExp("^(?<text>[ \\t]*(///.*?[\\r\\n]*)+)$", "gm");
}
