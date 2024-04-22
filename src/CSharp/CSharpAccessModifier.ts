export enum CSharpAccessModifier {
    none,

    public,
    explicitInterfaceImplementation, // implicitly public
    internal,
    protected,
    private,
    protectedInternal,
    privateProtected,
    file
}

export namespace CSharpAccessModifier {
    export function fromString(accessModifier: string): CSharpAccessModifier {
        if (accessModifier.includes("public")) return CSharpAccessModifier.public;
        // do not use: if (accessModifier.includes("explicit interface")) return CSharpAccessModifier.explicitInterfaceImplementation;
        if (accessModifier.includes("protected internal")) return CSharpAccessModifier.protectedInternal;
        if (accessModifier.includes("private protected")) return CSharpAccessModifier.privateProtected;
        if (accessModifier.includes("internal")) return CSharpAccessModifier.internal;
        if (accessModifier.includes("protected")) return CSharpAccessModifier.protected;
        if (accessModifier.includes("private")) return CSharpAccessModifier.private;
        if (accessModifier.includes("file")) return CSharpAccessModifier.file;
        return CSharpAccessModifier.none;
    }

    export function toString(accessModifier: CSharpAccessModifier): string {
        switch (accessModifier) {
            case CSharpAccessModifier.public: return "public";
            case CSharpAccessModifier.explicitInterfaceImplementation: return "explicit interface";
            case CSharpAccessModifier.internal: return "internal";
            case CSharpAccessModifier.protected: return "protected";
            case CSharpAccessModifier.private: return "private";
            case CSharpAccessModifier.protectedInternal: return "protected internal";
            case CSharpAccessModifier.privateProtected: return "private protected";
            case CSharpAccessModifier.file: return "file";
            default: return "none";
        }
    }
}
