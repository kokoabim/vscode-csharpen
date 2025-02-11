export enum CSharpMemberModifiers {
    none = 0,

    static = 1 << 0,
    extern = 1 << 1,
    new = 1 << 2,
    virtual = 1 << 3,
    partial = 1 << 4,
    abstract = 1 << 5,
    sealed = 1 << 6,
    override = 1 << 7,
    readonly = 1 << 8,
    unsafe = 1 << 9,
    volatile = 1 << 10,
    async = 1 << 11,
}

export namespace CSharpMemberModifiers {
    export function hasFlag(value: CSharpMemberModifiers, flag: CSharpMemberModifiers): boolean {
        return (value & flag) === flag;
    }

    export function fromString(memberModifiers: string): CSharpMemberModifiers {
        let modifiers = CSharpMemberModifiers.none;
        if (memberModifiers.includes("abstract")) modifiers |= CSharpMemberModifiers.abstract;
        if (memberModifiers.includes("async")) modifiers |= CSharpMemberModifiers.async;
        if (memberModifiers.includes("extern")) modifiers |= CSharpMemberModifiers.extern;
        if (memberModifiers.includes("new")) modifiers |= CSharpMemberModifiers.new;
        if (memberModifiers.includes("override")) modifiers |= CSharpMemberModifiers.override;
        if (memberModifiers.includes("partial")) modifiers |= CSharpMemberModifiers.partial;
        if (memberModifiers.includes("readonly")) modifiers |= CSharpMemberModifiers.readonly;
        if (memberModifiers.includes("sealed")) modifiers |= CSharpMemberModifiers.sealed;
        if (memberModifiers.includes("static")) modifiers |= CSharpMemberModifiers.static;
        if (memberModifiers.includes("unsafe")) modifiers |= CSharpMemberModifiers.unsafe;
        if (memberModifiers.includes("virtual")) modifiers |= CSharpMemberModifiers.virtual;
        if (memberModifiers.includes("volatile")) modifiers |= CSharpMemberModifiers.volatile;
        return modifiers;
    }

    export function fromDelimitedString(memberModifiers: string, delimiter = ","): CSharpMemberModifiers {
        return fromString(memberModifiers.split(delimiter).map(m => m.trim()).join(" "));
    }
}
