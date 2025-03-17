export class CSharpPatterns {
    private static readonly _nullArr = "\\??(\\[\\]\\??)*";

    public static readonly name = "[a-zA-Z][a-zA-Z0-9_]+";
    public static readonly namespace = `(${CSharpPatterns.name}(\\.${CSharpPatterns.name})*)`;
    public static readonly typeWithGen = `${CSharpPatterns.name}(\\<.*?\\>)?`;
    public static readonly typeWithGenNullArr = `(${CSharpPatterns.typeWithGen}${CSharpPatterns._nullArr})`;
    public static readonly tupleType = `(\\(${CSharpPatterns.typeWithGenNullArr}(,\\s*${CSharpPatterns.typeWithGenNullArr})+\\)${CSharpPatterns._nullArr})`;
    public static readonly anyType = `(${CSharpPatterns.typeWithGenNullArr}|${CSharpPatterns.tupleType})`;

    public static readonly attributes = "(?<attributes>(\\s*\\[.+\\]\\s*)*)?";
    public static readonly modifiers = "(?<modifiers>(\\s*(new|public|protected|private|internal|protected\\s+internal|private\\s+protected|file|static|extern|virtual|partial|abstract|sealed|override|readonly|unsafe|volatile|async|required)\\s+)*)?";
    public static readonly attributesAndModifiersRegExp = new RegExp(`${CSharpPatterns.attributes}${CSharpPatterns.modifiers}`, "gs");

    public static readonly closePreprocessorDirectives = new RegExp("^(?<text>[ \\t]*#[ \\t]*(endif|pragma).*?)\\r?\\n", "gm");
    public static readonly delegateKeyword = "\\bdelegate\\b";
    public static readonly frameworkTypes = "\\b(((System\\.)?((Boolean)|(S?Byte)|(Char)|(Decimal)|(Double)|(Single)|(U?Int(16|32|64|Ptr))|(Object)|(String)))|(System\\.Int128))\\b"; // NOTE: Int128 must include System. prefix (since there is not actual language type and this pattern is used to convert BCL types to language keyword)
    public static readonly implementsRegExp = new RegExp(`\\s*(?<type>${CSharpPatterns.anyType})(\\s*,\\s*)?`, "g");
    public static readonly multiLineCommentRegExp = new RegExp("(?<text>/\\*.*?\\*/)", "gs");
    public static readonly namespaceDeclarationFileScopedRegExp = new RegExp(`^(?<declaration>(?<signature>[ \\t]*namespace\\s+(?<namespace>${CSharpPatterns.namespace}))\\s*;)`, "gm");
    public static readonly namespaceDeclarationWithBodyRegExp = new RegExp(`^(?<declaration>(?<signature>[ \\t]*namespace\\s+(?<namespace>${CSharpPatterns.namespace}))\\s*\\{.*?\\})`, "gms");
    public static readonly nonNewLine = new RegExp("[^\\r\\n]", "g");
    public static readonly openPreprocessorDirectives = new RegExp("^(?<text>[ \\t]*#[ \\t]*(if|pragma).*?)\\r?\\n", "gm");
    public static readonly singleLineCommentRegExp = new RegExp("^(?<text>[ \\t]*//.*?[\\r\\n]*)$", "gm");
    public static readonly symbolTypeKeywords = "^(?<keywords>(interface|record(\\s+class)?|class|record(\\s+struct)?|struct|enum))$";
    public static readonly symbolTypeOnlyWithReturnTypeFirst = `(?<returnType>${this.anyType})\\s+(?<symbolType>operator)`;
    public static readonly symbolTypeOnlyWithReturnTypeLast = `(?<symbolType>\\s*(delegate|event|const|(explicit|implicit)\\s+operator))\\s+(?<returnType>${this.anyType})`;
    public static readonly symbolTypeWithReturnTypeKeywords = `(?<keywords>(delegate\\s+${this.anyType}|event\\s+${this.anyType}|const\\s+${this.anyType}|(explicit|implicit)\\s+operator\\s+${this.anyType}|${this.anyType}\\s+operator))`;
    public static readonly usingDirectiveRegExp = new RegExp(`^(?<directive>[ \\t]*(?<g>global\\s+)?using\\s+(?<s>static\\s+)?((?<name>${CSharpPatterns.name})\\s*=\\s*)?(?<namespace>${CSharpPatterns.namespace})\\s*;[\\r\\n]*)`, "gm");
    public static readonly xmlCommentRegExp = new RegExp("^(?<text>[ \\t]*(///.*?[\\r\\n]*)+)$", "gm");

    public static isMatch(target: string, pattern: string): boolean {
        return target.match(pattern) !== null;
    }
}