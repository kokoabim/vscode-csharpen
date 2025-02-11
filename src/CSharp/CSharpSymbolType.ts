export enum CSharpSymbolType {
    none,

    file,
    nonCodeblock,

    using,
    namespace,

    delegate,
    interface,
    class,
    struct,
    enum,
    recordClass,
    recordStruct,

    event,
    constant,
    property,
    field,

    staticConstructor,
    primaryConstructor,
    constructor,
    indexer,
    finalizer,
    method,
    operator,
}

export namespace CSharpSymbolType {
    export function canHaveChildren(type: CSharpSymbolType): boolean {
        switch (type) {
            case CSharpSymbolType.class:
            case CSharpSymbolType.interface:
            case CSharpSymbolType.namespace:
            case CSharpSymbolType.recordClass:
            case CSharpSymbolType.recordStruct:
            case CSharpSymbolType.struct:
                return true;

            default: return false;
        }
    }

    export function canImproperlyBeOnFileLevel(type: CSharpSymbolType): boolean {
        switch (type) {
            case CSharpSymbolType.class:
            case CSharpSymbolType.delegate:
            case CSharpSymbolType.enum:
            case CSharpSymbolType.interface:
            case CSharpSymbolType.namespace:
            case CSharpSymbolType.recordClass:
            case CSharpSymbolType.recordStruct:
            case CSharpSymbolType.struct:
                return true;

            default: return false;
        }
    }

    export function fromString(type: string): CSharpSymbolType {
        switch (type.toLocaleLowerCase()) {
            case "class": return CSharpSymbolType.class;
            case "constant": return CSharpSymbolType.constant;
            case "delegate": return CSharpSymbolType.delegate;
            case "enum": return CSharpSymbolType.enum;
            case "event": return CSharpSymbolType.event;
            case "field": return CSharpSymbolType.field;
            case "indexer": return CSharpSymbolType.indexer;
            case "interface": return CSharpSymbolType.interface;
            case "method": return CSharpSymbolType.method;
            case "namespace": return CSharpSymbolType.namespace;
            case "operator": return CSharpSymbolType.operator;
            case "property": return CSharpSymbolType.property;
            case "recordclass": return CSharpSymbolType.recordClass;
            case "recordstruct": return CSharpSymbolType.recordStruct;
            case "struct": return CSharpSymbolType.struct;

            default: return CSharpSymbolType.none;
        }
    }

    export function fromDelimitedString(types: string, delimiter = ","): CSharpSymbolType[] {
        return types.split(delimiter).map(t => fromString(t.trim())).filter(t => t !== CSharpSymbolType.none);
    }

    export function toPluralString(symbolType: CSharpSymbolType): string {
        switch (symbolType) {
            case CSharpSymbolType.using: return "usings";
            case CSharpSymbolType.namespace: return "namespaces";

            case CSharpSymbolType.class: return "classes";
            case CSharpSymbolType.interface: return "interfaces";
            case CSharpSymbolType.enum: return "enums";
            case CSharpSymbolType.struct: return "structs";

            case CSharpSymbolType.recordClass: return "records";
            case CSharpSymbolType.recordStruct: return "record structs";


            case CSharpSymbolType.delegate: return "delegates";
            case CSharpSymbolType.event: return "events";
            case CSharpSymbolType.constant: return "constants";
            case CSharpSymbolType.property: return "properties";
            case CSharpSymbolType.field: return "fields";

            case CSharpSymbolType.staticConstructor: return "static constructors";
            case CSharpSymbolType.primaryConstructor: return "primary constructors";
            case CSharpSymbolType.constructor: return "constructors";
            case CSharpSymbolType.indexer: return "indexers";
            case CSharpSymbolType.finalizer: return "finalizers";
            case CSharpSymbolType.method: return "methods";
            case CSharpSymbolType.operator: return "operators";

            default: return "noType";
        }
    }

    export function toString(symbolType: CSharpSymbolType): string {
        switch (symbolType) {
            case CSharpSymbolType.using: return "using";
            case CSharpSymbolType.namespace: return "namespace";

            case CSharpSymbolType.class: return "class";
            case CSharpSymbolType.interface: return "interface";
            case CSharpSymbolType.enum: return "enum";
            case CSharpSymbolType.struct: return "struct";

            case CSharpSymbolType.recordClass: return "record";
            case CSharpSymbolType.recordStruct: return "record struct";

            case CSharpSymbolType.delegate: return "delegate";
            case CSharpSymbolType.event: return "event";
            case CSharpSymbolType.constant: return "constant";
            case CSharpSymbolType.property: return "property";
            case CSharpSymbolType.field: return "field";

            case CSharpSymbolType.staticConstructor: return "static constructor";
            case CSharpSymbolType.constructor: return "constructor";
            case CSharpSymbolType.indexer: return "indexer";
            case CSharpSymbolType.finalizer: return "finalizer";
            case CSharpSymbolType.method: return "method";
            case CSharpSymbolType.operator: return "operator";

            default: return "noType";
        }
    }
}
