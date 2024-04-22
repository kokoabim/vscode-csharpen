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
}
