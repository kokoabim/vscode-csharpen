export enum CSharpType {
    none,
    bool,
    byte,
    char,
    decimal,
    double,
    dynamic,
    float,
    int,
    long,
    nint,
    nuint,
    object,
    sbyte,
    short,
    string,
    uint,
    ulong,
    ushort,
    var,
    void,
    other
}

export namespace CSharpType {
    export function replaceFrameworkTypesToLanguageKeywords(typeText: string): string {
        return typeText
            .replace(/(System\.)?Boolean/g, "bool")

            .replace(/(System\.)?SByte/g, "sbyte")
            .replace(/(System\.)?Byte/g, "byte")
            .replace(/(System\.)?Char/g, "char")

            .replace(/(System\.)?Decimal/g, "decimal")
            .replace(/(System\.)?Double/g, "double")
            .replace(/(System\.)?Single/g, "float")

            .replace(/(System\.)?UInt16/g, "ushort")
            .replace(/(System\.)?Int16/g, "short")

            .replace(/(System\.)?UInt32/g, "uint")
            .replace(/(System\.)?Int32/g, "int")

            .replace(/(System\.)?UInt64/g, "ulong")
            .replace(/(System\.)?Int64/g, "long")

            .replace(/(System\.)?UIntPtr/g, "nuint")
            .replace(/(System\.)?IntPtr/g, "nint")

            .replace(/(System\.)?Object/g, "object")
            .replace(/(System\.)?String/g, "string")
            .replace(/System\.Int128/g, "Int128"); // NOTE: Int128 must include System. prefix
    }

    export function frameworkTypeToLanguageKeyword(frameworkType: string): CSharpType {
        switch (frameworkType.toLocaleLowerCase()) {
            case "boolean":
            case "system.boolean":
                return CSharpType.bool;

            case "byte":
            case "system.byte":
                return CSharpType.byte;

            case "char":
            case "system.char":
                return CSharpType.char;

            case "decimal":
            case "system.decimal":
                return CSharpType.decimal;

            case "double":
            case "system.double":
                return CSharpType.double;

            case "single":
            case "system.single":
                return CSharpType.float;

            case "int":
            case "system.int32":
                return CSharpType.int;

            case "long":
            case "system.int64":
                return CSharpType.long;

            case "intptr":
            case "system.intptr":
                return CSharpType.nint;

            case "uintptr":
            case "system.uintptr":
                return CSharpType.nuint;

            case "sbyte":
            case "system.sbyte":
                return CSharpType.sbyte;

            case "short":
            case "system.int16":
                return CSharpType.short;

            case "string":
            case "system.string":
                return CSharpType.string;

            case "uint":
            case "system.uint32":
                return CSharpType.uint;

            case "ulong":
            case "system.uint64":
                return CSharpType.ulong;

            case "ushort":
            case "system.uint16":
                return CSharpType.ushort;

            case "object":
            case "system.object":
                return CSharpType.object;

            default:
                return CSharpType.none;
        }
    }

    export function fromString(type?: string): CSharpType {
        switch (type) {
            case undefined:
                return CSharpType.none;

            case "bool":
            case "Boolean":
            case "System.Boolean":
                return CSharpType.bool;

            case "byte":
            case "Byte":
            case "System.Byte":
                return CSharpType.byte;

            case "char":
            case "Char":
            case "System.Char":
                return CSharpType.char;

            case "decimal":
            case "Decimal":
            case "System.Decimal":
                return CSharpType.decimal;

            case "double":
            case "Double":
            case "System.Double":
                return CSharpType.double;

            case "float":
            case "Single":
            case "System.Single":
                return CSharpType.float;

            case "int":
            case "Int32":
            case "System.Int32":
                return CSharpType.int;

            case "long":
            case "Int64":
            case "System.Int64":
                return CSharpType.long;

            case "nint":
            case "System.IntPtr":
                return CSharpType.nint;

            case "nuint":
            case "System.UIntPtr":
                return CSharpType.nuint;

            case "sbyte":
            case "SByte":
            case "System.SByte":
                return CSharpType.sbyte;

            case "short":
            case "Int16":
            case "System.Int16":
                return CSharpType.short;

            case "string":
            case "String":
            case "System.String":
                return CSharpType.string;

            case "uint":
            case "UInt32":
            case "System.UInt32":
                return CSharpType.uint;

            case "ulong":
            case "UInt64":
            case "System.UInt64":
                return CSharpType.ulong;

            case "ushort":
            case "UInt16":
            case "System.UInt16":
                return CSharpType.ushort;

            case "dynamic":
                return CSharpType.dynamic;

            case "object":
            case "Object":
            case "System.Object":
                return CSharpType.object;

            case "var":
                return CSharpType.var;

            case "void":
                return CSharpType.void;

            default:
                return CSharpType.other;
        }
    }

    export function toString(type: CSharpType): string | undefined {
        switch (type) {
            case CSharpType.bool: return "bool";
            case CSharpType.byte: return "byte";
            case CSharpType.char: return "char";
            case CSharpType.decimal: return "decimal";
            case CSharpType.double: return "double";
            case CSharpType.float: return "float";
            case CSharpType.int: return "int";
            case CSharpType.long: return "long";
            case CSharpType.nint: return "nint";
            case CSharpType.nuint: return "nuint";
            case CSharpType.sbyte: return "sbyte";
            case CSharpType.short: return "short";
            case CSharpType.string: return "string";
            case CSharpType.uint: return "uint";
            case CSharpType.ulong: return "ulong";
            case CSharpType.ushort: return "ushort";
            case CSharpType.dynamic: return "dynamic";
            case CSharpType.object: return "object";
            case CSharpType.var: return "var";
            case CSharpType.void: return "void";
            default: return undefined;
        }
    }
}
