import "../Extensions/Array.extensions";
import "../Extensions/String.extensions";
import { CSharpAccessModifier } from './CSharpAccessModifier';
import { CSharpenVSCodeExtensionSettings } from "../VSCodeExtension/CSharpenVSCodeExtensionSettings";
import { CSharpFile } from "./CSharpFile";
import { CSharpMemberModifiers } from "./CSharpMemberModifiers";
import { CSharpPatterns } from './CSharpPatterns';
import { CSharpSymbolType } from './CSharpSymbolType';
import { RegionGroup } from "../Models/RegionGroup";
import { StringBuilder } from "../Utils/StringBuilder";
import { StringSpan } from "../Models/StringSpan";
import * as vscode from 'vscode';
import util from 'node:util';

export class CSharpSymbol {
    readonly data: { [key: string]: any } = {};

    accessModifier = CSharpAccessModifier.none;
    children: CSharpSymbol[] = [];
    implements: string[] = [];
    memberModifiers = CSharpMemberModifiers.none;
    name!: string;
    namespace?: string;
    parent?: CSharpSymbol;
    regions: { start: string | undefined, end: string | undefined, groups: RegionGroup[] } = { start: undefined, end: undefined, groups: [] };
    returnType?: string | undefined;
    type = CSharpSymbolType.none;

    private readonly link: { before: CSharpSymbol | undefined, after: CSharpSymbol | undefined } = { before: undefined, after: undefined };

    private body = "";
    private footer = "";
    private fullName!: string;
    private header = "";
    private nameEndPosition?: vscode.Position;
    private position?: vscode.Position;
    private range?: vscode.Range;
    private textDocument?: vscode.TextDocument;

    private constructor() { }

    get canHaveChildren(): boolean { return CSharpSymbolType.canHaveChildren(this.type); }

    get hasChildren(): boolean { return this.children.length > 0; }

    get innerText(): string {
        if (!this.canHaveChildren) return `${this.header ? this.header + "\n" : ""}${this.body}${this.footer ? "\n" + this.footer : ""}`;
        else if (this.children.length === 0) return `${this.header ? this.header + "\n" : ""}${this.footer ? this.footer : ""}`;

        const body = CSharpSymbol.join(this.children);
        return `${this.header ? this.header + "\n" : ""}${body}${this.footer ? "\n" + this.footer : ""}`;
    }

    get isMultiLine(): boolean { return this.innerText.includes("\n"); }

    get text(): string {
        const regionStart = this.regions.start !== undefined ? `${(this.parent?.header.endsWith("{") ? CSharpenVSCodeExtensionSettings.shared().indentation : "")}#region ${this.regions.start}\n${this.canHaveChildren || this.isMultiLine ? "\n" : ""}` : "";
        const regionEnd = this.regions.end !== undefined ? `${this.canHaveChildren || this.isMultiLine ? "\n" : ""}\n${(this.parent?.header.endsWith("{") ? CSharpenVSCodeExtensionSettings.shared().indentation : "")}#endregion ${this.regions.end}` : "";

        return `${regionStart}${this.innerText}${regionEnd}`;
    }

    static addUsingAndNamespaceSymbols(usingAndNamespaceSymbols: CSharpSymbol[], symbols: CSharpSymbol[]): void {
        const namespaceSymbols = usingAndNamespaceSymbols.filter(s => s.type === CSharpSymbolType.namespace);
        const singleFileScopedNamespaceExists = namespaceSymbols.filter(s => s.data.isFileScoped).length === 1;

        for (let i = symbols.length - 1; i >= 0; i--) {
            const s = symbols[i];

            if (s.parent) continue;

            const namespaceSymbol = singleFileScopedNamespaceExists ? namespaceSymbols[0] : CSharpSymbol.getNamespaceByPosition(namespaceSymbols, s.position!);
            if (!namespaceSymbol) continue;

            s.parent = namespaceSymbol;
            s.parent.children.push(s);

            symbols.splice(i, 1);
        }

        symbols.unshift(...usingAndNamespaceSymbols);
        CSharpSymbol.orderByPosition(symbols);
    }

    static create(textDocument: vscode.TextDocument, documentSymbol: vscode.DocumentSymbol, parent?: CSharpSymbol): CSharpSymbol {
        const symbol = new CSharpSymbol();
        symbol.range = CSharpSymbol.adjustRange(textDocument, documentSymbol.range, documentSymbol.kind);
        symbol.body = textDocument.getText(symbol.range);
        symbol.fullName = documentSymbol.detail; // FQDN-class name; method name (not FQDN) and parameters; property name
        symbol.name = documentSymbol.name;
        symbol.nameEndPosition = documentSymbol.selectionRange.end;
        symbol.parent = parent;
        symbol.position = documentSymbol.range.start;
        symbol.textDocument = textDocument;
        symbol.type = CSharpSymbol.symbolTypeFromDocumentSymbol(documentSymbol);
        symbol.accessModifier = CSharpSymbol.defaultAccessModifierForType(symbol.type, parent?.type);

        CSharpSymbol.parseNameAndNamespace(symbol);
        CSharpSymbol.parseCodeBeforeSymbolName(symbol, symbol.body); // no need to handle boolean return value here

        if (symbol.type === CSharpSymbolType.method && symbol.name.includes(".")) symbol.accessModifier = CSharpAccessModifier.explicitInterfaceImplementation;
        else if (symbol.type === CSharpSymbolType.class && documentSymbol.kind === vscode.SymbolKind.Method && parent && symbol.range.isEqual(parent.range!)) symbol.type = CSharpSymbolType.primaryConstructor;

        if (documentSymbol.children.length > 0 && symbol.type !== CSharpSymbolType.enum) symbol.children = documentSymbol.children.map(ds => CSharpSymbol.create(textDocument, ds, symbol));

        return symbol;
    }

    /** 1. Creates non-codeblock symbols containing text before and after each symbol of provided {@link symbols} array and adds them to {@link CSharpSymbol.link} of the corresponding symbol. Non-codeblock symbols are not added to provided {@link symbols} array.
     * 2. Moves comments from non-codeblock symbols to the corresponding symbols.
     * 3. Moves preprocessor directives from non-codeblock symbols to the corresponding symbols. */
    static createNonCodeblockSymbols(textDocument: vscode.TextDocument, usingAndNamespaceSymbols: CSharpSymbol[], symbols: CSharpSymbol[], parent?: CSharpSymbol): void {
        const nonCodeblockSymbols: CSharpSymbol[] = [];

        const parentEndOffset = parent?.type === CSharpSymbolType.namespace && parent.data.isFileScoped ? 0 : -1;

        const parentOrFileEndPosition = (parent?.range?.end ? CSharpSymbol.adjustPosition(textDocument, parent.range.end, parentEndOffset) : undefined)
            ?? textDocument.lineAt(textDocument.lineCount - 1)!.range.end;

        const parentOrFileOpenedPosition = parent
            ? CSharpSymbol.positionAtStartOfCodeblock(parent.nameEndPosition ?? CSharpFile.zeroPosition, textDocument, parentOrFileEndPosition)
            : CSharpFile.zeroPosition;

        let currentBlockStart: vscode.Position | undefined;
        let previousBlockEnd = new vscode.Position(parentOrFileOpenedPosition.line, parentOrFileOpenedPosition.character);
        let previousSymbol: CSharpSymbol | undefined;

        for (const currentSymbol of symbols) {
            previousBlockEnd = previousSymbol?.range?.end ?? parentOrFileOpenedPosition;
            currentBlockStart = currentSymbol.range?.start;

            if (!currentBlockStart) throw new Error(`Symbol does not have a range start: type=${CSharpSymbolType[currentSymbol.type]}, fullName=${currentSymbol.fullName}`);

            CSharpSymbol.createNonCodeblock(nonCodeblockSymbols, new vscode.Range(previousBlockEnd, currentBlockStart), currentSymbol, previousSymbol, parent);

            if (currentSymbol.hasChildren) CSharpSymbol.createNonCodeblockSymbols(textDocument, usingAndNamespaceSymbols, currentSymbol.children, currentSymbol);

            previousSymbol = currentSymbol;
        }

        if (previousSymbol && previousSymbol.range && previousSymbol.range.end.isBefore(parentOrFileEndPosition)) {
            CSharpSymbol.createNonCodeblock(nonCodeblockSymbols, new vscode.Range(previousSymbol.range.end, parentOrFileEndPosition), undefined, previousSymbol, parent);
        }

        CSharpSymbol.moveCommentsFromNonCodeblockSymbols(symbols);
        CSharpSymbol.movePreprocessorDirectivesFromNonCodeblockSymbols(symbols);
    }

    /** Creates {@link CSharpSymbol} array of provided {@link documentSymbols}, organizes parent-to-child hierarchy and orders symbols by file position recursively. */
    static createSymbols(textDocument: vscode.TextDocument, documentSymbols: vscode.DocumentSymbol[]): CSharpSymbol[] {
        const symbols = documentSymbols.map(s => CSharpSymbol.create(textDocument, s));
        CSharpSymbol.organizeParentToChildHierarchy(symbols);
        return CSharpSymbol.orderByPosition(symbols);
    }

    /** Creates array of using and namespace symbols. */
    static createUsingAndNamespaceSymbols(textDocument: vscode.TextDocument, symbols: CSharpSymbol[]): CSharpSymbol[] {
        let strippedDocumentText = CSharpSymbol.stripSymbolAndCommentText(textDocument, symbols);
        let usingSymbols: CSharpSymbol[];
        let namespaceSymbols: CSharpSymbol[];

        [usingSymbols, strippedDocumentText] = CSharpSymbol.createUsingDirectives(textDocument, strippedDocumentText);
        [namespaceSymbols, strippedDocumentText] = CSharpSymbol.createNamespaceDeclarations(textDocument, strippedDocumentText);

        return CSharpSymbol.orderByPosition(usingSymbols.concat(namespaceSymbols));
    }

    static join(symbols: CSharpSymbol[]): string {
        const sb = new StringBuilder();

        symbols.forEach((s, i, a) => {
            const d = CSharpSymbol.joinDelimiter(i > 0 ? a[i - 1] : undefined, s);
            sb.append(`${d}${s.text}`);
        });

        return sb.toString();
    }

    [util.inspect.custom](): string {
        return `${CSharpSymbolType[this.type]}${this.hasChildren ? `[${this.children.length}]` : ""}: ${this.name ?? this.fullName}`;
    }

    debug(depth = 0): void {
        console.log(`${depth > 0 ? " ".repeat(depth * 4) : ""}${CSharpSymbolType[this.type]}${this.hasChildren ? `[${this.children.length}]` : ""}: ${this.name}${this.namespace ? `, namespace=${this.namespace}` : ""}${this.parent ? `, parent=${this.parent.name}` : ""}${this.accessModifier !== CSharpAccessModifier.none ? `, accessModifier=${CSharpAccessModifier[this.accessModifier]}` : ""}`);
        this.children.forEach(c => c.debug(depth + 1));
    }

    doesImplement(typeToCheck: string, isGenericType: boolean, availableSymbolsToRecurse?: CSharpSymbol[]): boolean {
        return /* 'this' implements 'typeToCheck' */ this.implements.anyMatches(`^${typeToCheck}${isGenericType ? "<.*?>" : ""}$`)
            /* check what each 'availableSymbolsToRecurse' implements... */ || (availableSymbolsToRecurse !== undefined && availableSymbolsToRecurse.some(s =>
                /* class/interface */(s.type === CSharpSymbolType.class || s.type === CSharpSymbolType.interface)
                /* 'this' implements class/interface */ && this.implements.includes(s.name)
                /* class/interface implements 'typeToCheck' */ && (s.implements.anyMatches(`^${typeToCheck}${isGenericType ? "<.*?>" : ""}$`) || s.doesImplement(typeToCheck, isGenericType, availableSymbolsToRecurse))));
    }

    private static adjustPosition(textDocument: vscode.TextDocument, position: vscode.Position, offset: number): vscode.Position {
        return textDocument.positionAt(textDocument.offsetAt(position) + offset);
    }

    private static adjustRange(textDocument: vscode.TextDocument, range: vscode.Range, kindOrType: vscode.SymbolKind | CSharpSymbolType): vscode.Range {
        const previousNewLineOrBlockChars = "\n\r};";
        const text = textDocument.getText();
        const length = text.length;

        let startIndex = textDocument.offsetAt(range.start);
        while (startIndex > 0 && !previousNewLineOrBlockChars.includes(text[startIndex])) startIndex--;
        startIndex++;

        if (kindOrType !== vscode.SymbolKind.Event && kindOrType !== CSharpSymbolType.event) return range.with({ start: textDocument.positionAt(startIndex) });

        let endIndex = textDocument.offsetAt(range.end);
        while (endIndex < length && text[endIndex] !== ";") endIndex++;

        return new vscode.Range(textDocument.positionAt(startIndex), textDocument.positionAt(endIndex + 1));
    }

    private static comparePosition(a: CSharpSymbol, b: CSharpSymbol): number {
        if (!a.position || !b.position) return 0;
        return a.position.compareTo(b.position) ?? 0;
    }

    private static createNamespace(namespace: string, range: vscode.Range, nameEndPosition: vscode.Position, isFileScoped: boolean): CSharpSymbol {
        const symbol = new CSharpSymbol();

        if (isFileScoped) {
            symbol.header = `namespace ${namespace};`;
        }
        else {
            symbol.header = `namespace ${namespace} {`;
            symbol.footer = "}";
        }

        symbol.name = namespace;
        symbol.nameEndPosition = nameEndPosition;
        symbol.position = range.start;
        symbol.range = range;
        symbol.type = CSharpSymbolType.namespace;

        symbol.data.isFileScoped = isFileScoped;

        return symbol;
    }

    private static createNamespaceDeclarations(textDocument: vscode.TextDocument, strippedDocumentText: string): [CSharpSymbol[], string] {
        const symbols: CSharpSymbol[] = [];
        let m;

        for (const re of [CSharpPatterns.namespaceDeclarationFileScopedRegExp, CSharpPatterns.namespaceDeclarationWithBodyRegExp]) {
            const isFileScoped = re === CSharpPatterns.namespaceDeclarationFileScopedRegExp;

            while ((m = re.exec(strippedDocumentText)) !== null) {
                const declaration = m.groups?.declaration;
                const namespace = m.groups?.namespace;
                const signature = m.groups?.signature;
                if (!declaration || !namespace || !signature) continue;

                re.lastIndex = 0; // yes, reset it since we're using it in a loop against a string that is being modified

                if (isFileScoped && symbols.filter(s => s.data.isFileScoped).length > 0) throw new Error("Multiple file-scoped namespaces are not supported.");

                const symbol = CSharpSymbol.createNamespace(
                    namespace,
                    new vscode.Range(textDocument.positionAt(m.index), textDocument.positionAt(m.index + declaration.length)),
                    textDocument.positionAt(m.index + signature.length),
                    isFileScoped);

                symbols.push(symbol);

                strippedDocumentText = strippedDocumentText.substring(0, m.index) + declaration.replaceAll(CSharpPatterns.nonNewLine, " ") + strippedDocumentText.substring(m.index + declaration.length);
            }
        }

        return [symbols, strippedDocumentText];
    }

    private static createNonCodeblock(nonCodeblockSymbols: CSharpSymbol[], range: vscode.Range, current?: CSharpSymbol, previous?: CSharpSymbol, parent?: CSharpSymbol): void {
        const anySymbol = current ?? previous;
        if (!anySymbol) return;

        if (!anySymbol.getText(range)) return;

        const symbol = new CSharpSymbol();
        symbol.range = CSharpSymbol.adjustRange(anySymbol.textDocument!, range, CSharpSymbolType.nonCodeblock);
        symbol.body = anySymbol.getText(symbol.range)!;
        symbol.name = `${previous ? `${previous.name}:` : ""}NonCodeblock:${anySymbol.name}`;
        symbol.namespace = anySymbol.namespace;
        symbol.parent = parent;
        symbol.position = symbol.range.start;
        symbol.textDocument = anySymbol.textDocument;
        symbol.type = CSharpSymbolType.nonCodeblock;

        if (previous) {
            previous.link.after = symbol;
            symbol.link.before = previous;
        }

        if (current) { // there is no 'current' if this is after the last symbol ('current's follow previous non-codeblock symbols)
            current.link.before = symbol;
            symbol.link.after = current;
        }

        nonCodeblockSymbols.push(symbol);
    }

    private static createUsing(directive: string, namespace: string, range: vscode.Range): CSharpSymbol {
        const symbol = new CSharpSymbol();
        symbol.body = directive.trim();
        symbol.name = namespace;
        symbol.position = range.start;
        symbol.range = range;
        symbol.type = CSharpSymbolType.using;
        return symbol;
    }

    private static createUsingDirectives(textDocument: vscode.TextDocument, strippedDocumentText: string): [CSharpSymbol[], string] {
        const symbols: CSharpSymbol[] = [];
        let m;

        while ((m = CSharpPatterns.usingDirectiveRegExp.exec(strippedDocumentText)) !== null) {
            const directive = m.groups?.directive;
            const namespace = m.groups?.namespace;
            if (!directive || !namespace) continue;

            CSharpPatterns.usingDirectiveRegExp.lastIndex = 0;

            const symbol = CSharpSymbol.createUsing(directive, namespace, new vscode.Range(textDocument.positionAt(m.index), textDocument.positionAt(m.index + directive.length)));
            symbols.push(symbol);

            strippedDocumentText = strippedDocumentText.substring(0, m.index) + directive.replaceAll(CSharpPatterns.nonNewLine, " ") + strippedDocumentText.substring(m.index + directive.length);
        }

        return [symbols, strippedDocumentText];
    }

    private static defaultAccessModifierForType(symbolType: CSharpSymbolType, parentType = CSharpSymbolType.none): CSharpAccessModifier {
        // by symbolType

        if (symbolType <= CSharpSymbolType.namespace
            || symbolType === CSharpSymbolType.enum
            || symbolType === CSharpSymbolType.finalizer
            || symbolType === CSharpSymbolType.staticConstructor) return CSharpAccessModifier.none;
        else if (symbolType === CSharpSymbolType.operator) return CSharpAccessModifier.public;

        // by parentType

        if (parentType <= CSharpSymbolType.namespace) return CSharpAccessModifier.internal;
        else if (parentType === CSharpSymbolType.interface) return CSharpAccessModifier.public;

        // by default

        return CSharpAccessModifier.private;
    }

    private static extractSymbolText(symbol: CSharpSymbol, regExps: RegExp[], removeExtractedText: boolean): StringSpan[] {
        const spans: StringSpan[] = [];

        let m: RegExpExecArray | null;
        for (const re of regExps) {
            re.lastIndex = 0;

            while ((m = re.exec(symbol.body)) !== null) {
                if (!m?.groups?.text || spans.some(s => m!.index >= s.start && m!.index <= s.end)) continue;
                spans.push(new StringSpan(m.index, m.index + m.groups.text.length, m.groups.text));
            }
        }

        if (removeExtractedText) CSharpSymbol.removeStringSpans(symbol, spans);

        return spans;
    }

    private static getNamespaceByPosition(namespaceSymbols: CSharpSymbol[], position: vscode.Position): CSharpSymbol | undefined {
        return namespaceSymbols.filter(s => s.range?.contains(position)).sort((a, b) => a.range!.end.compareTo(b.range!.end))[0];
    }

    private static joinDelimiter(previous: CSharpSymbol | undefined, current: CSharpSymbol): string {
        if (!previous) {
            if (current.parent?.type === CSharpSymbolType.namespace && current.parent.data.isFileScoped) return "\n";
            else return "";
        }

        if (!previous.parent || !current.parent || previous.parent === current.parent) {
            if (current.parent?.type === CSharpSymbolType.interface && previous.type === current.type) return "\n";

            if (previous.type === current.type) {
                switch (current.type) {
                    case CSharpSymbolType.using:
                        return "\n";

                    case CSharpSymbolType.delegate:
                    case CSharpSymbolType.event:
                    case CSharpSymbolType.constant:
                    case CSharpSymbolType.property:
                    case CSharpSymbolType.field:
                    case CSharpSymbolType.operator:
                        return current.isMultiLine || previous.isMultiLine ? "\n\n" : "\n";
                }
            }
        }

        return "\n\n";
    }

    private static moveCommentsFromNonCodeblockSymbols(symbols: CSharpSymbol[]): void {
        for (const symbol of symbols.filter(s => s.link.before?.type === CSharpSymbolType.nonCodeblock)) {
            if (moveComments(symbol, symbol.link.before!, true)) symbol.link.before = undefined;
        }

        const lastSymbol = symbols[symbols.length - 1];
        if (lastSymbol.link.after?.type === CSharpSymbolType.nonCodeblock) {
            if (moveComments(lastSymbol, lastSymbol.link.after!, false)) lastSymbol.link.after = undefined;
        }

        symbols.forEach(s => {
            if (s.hasChildren) CSharpSymbol.moveCommentsFromNonCodeblockSymbols(s.children);
        });

        function moveComments(symbol: CSharpSymbol, nonCodeblockSymbol: CSharpSymbol, isBefore: boolean): boolean {
            const stringSpans = CSharpSymbol.extractSymbolText(nonCodeblockSymbol, [CSharpPatterns.multiLineCommentRegExp, CSharpPatterns.xmlCommentRegExp, CSharpPatterns.singleLineCommentRegExp], true);
            if (stringSpans.length === 0) return nonCodeblockSymbol.isBodyWhitespace();

            stringSpans[stringSpans.length - 1].value = stringSpans[stringSpans.length - 1].value.trimEndLine();
            if (isBefore) symbol.insertOnHeader(stringSpans.map(c => c.value).join("\n"));
            else symbol.appendToFooter(stringSpans.map(c => c.value).join("\n"));

            return nonCodeblockSymbol.isBodyWhitespace();
        }
    }

    private static movePreprocessorDirectivesFromNonCodeblockSymbols(symbols: CSharpSymbol[]): void {
        for (const symbol of symbols.filter(s => s.type !== CSharpSymbolType.nonCodeblock && s.link.before?.type === CSharpSymbolType.nonCodeblock && s.link.after?.type === CSharpSymbolType.nonCodeblock)) {
            if (symbol.hasChildren) CSharpSymbol.movePreprocessorDirectivesFromNonCodeblockSymbols(symbol.children);

            const leadingStringSpans = CSharpSymbol.extractSymbolText(symbol.link.before!, [CSharpPatterns.openPreprocessorDirectives], false);
            if (leadingStringSpans.length === 0) continue;

            const trailingStringSpans = CSharpSymbol.extractSymbolText(symbol.link.after!, [CSharpPatterns.closePreprocessorDirectives], false);
            if (trailingStringSpans.length === 0) continue;

            // check if leading/trailing preprocessor directives match

            const leadingStringSpansToMove: StringSpan[] = [];
            const trailingStringSpansToMove: StringSpan[] = [];

            const ifPreProcDir = leadingStringSpans.filter(s => s.value.includes("#if"))[0];
            const endifPreProcDir = trailingStringSpans.filter(s => s.value.includes("#endif"))[0];
            if (ifPreProcDir && endifPreProcDir) {
                leadingStringSpansToMove.push(ifPreProcDir);
                trailingStringSpansToMove.push(endifPreProcDir);
            }

            const pragmaOpenPreProcDir = leadingStringSpans.filter(s => s.value.includes("#pragma"))[0];
            const pragmaClosePreProcDir = trailingStringSpans.filter(s => s.value.includes("#pragma"))[0];
            if (pragmaOpenPreProcDir && pragmaClosePreProcDir) {
                const pragmaOpenSplit = pragmaOpenPreProcDir.value.split(/[ \t]+/);
                const pragmaCloseSplit = pragmaClosePreProcDir.value.split(/[ \t]+/);
                if (pragmaOpenSplit.length >= 4 && pragmaCloseSplit.length >= 4 && pragmaOpenSplit.slice(3).join(" ") === pragmaCloseSplit.slice(3).join(" ")) {
                    leadingStringSpansToMove.push(pragmaOpenPreProcDir);
                    trailingStringSpansToMove.push(pragmaClosePreProcDir);
                }
            }

            // move preprocessor directives

            if (leadingStringSpansToMove.length > 0) {
                leadingStringSpansToMove.sortBy("start");
                leadingStringSpansToMove[leadingStringSpansToMove.length - 1].value = leadingStringSpansToMove[leadingStringSpansToMove.length - 1].value.trimEndLine();
                symbol.insertOnHeader(leadingStringSpansToMove.map(ss => ss.value).join("\n"));

                CSharpSymbol.removeStringSpans(symbol.link.before!, leadingStringSpansToMove);
                if (symbol.link.before!.isBodyWhitespace()) symbol.link.before = undefined;
            }

            if (trailingStringSpansToMove.length > 0) {
                trailingStringSpansToMove.sortBy("start");
                trailingStringSpansToMove[trailingStringSpansToMove.length - 1].value = trailingStringSpansToMove[trailingStringSpansToMove.length - 1].value.trimStartLine();
                symbol.appendToFooter(trailingStringSpansToMove.map(ss => ss.value).join("\n"));

                CSharpSymbol.removeStringSpans(symbol.link.after!, trailingStringSpansToMove);
                if (symbol.link.after!.isBodyWhitespace()) symbol.link.after = undefined;
            }
        }
    }

    /** Sorts symbols recursively (i.e. children) in place.
     * @returns Reference to the same array. */
    private static orderByPosition(symbols: CSharpSymbol[]): CSharpSymbol[] {
        symbols.sort(CSharpSymbol.comparePosition);

        symbols.forEach(s => {
            if (s.hasChildren) CSharpSymbol.orderByPosition(s.children);
        });

        return symbols;
    }

    /** Moves symbols that have no parent or a parent with {@link CSharpSymbolType.file} using the {@link CSharpSymbol.namespace} value to determine the parent.
     * @returns Reference to the same array. */
    private static organizeParentToChildHierarchy(symbols: CSharpSymbol[]): CSharpSymbol[] {
        const parentSymbols = symbols.filter(s => (!s.parent || s.parent.type === CSharpSymbolType.file) && s.canHaveChildren);
        if (parentSymbols.length === 0) return symbols;

        const symbolsToPossiblyMove = symbols.filter(s => (!s.parent || s.parent.type === CSharpSymbolType.file) && CSharpSymbolType.canImproperlyBeOnFileLevel(s.type) && s.namespace);
        if (symbolsToPossiblyMove.length === 0) return symbols;

        for (const symbol of symbolsToPossiblyMove) {
            for (const parentSymbol of parentSymbols) {
                if (symbol.namespace!.match(`^.*?${parentSymbol.name}$`) === null) continue;

                symbol.namespace = undefined;
                symbol.parent = parentSymbol;

                parentSymbol.children.push(symbol);
                symbols.splice(symbols.indexOf(symbol), 1);
                break;
            }
        }

        return symbols;
    }

    private static parseAttributesAndModifiers(symbol: CSharpSymbol, text: string): number {
        const attributesAndModifiersMatch = text.match(`^${CSharpPatterns.attributes}${CSharpPatterns.modifiers}`);
        if (!attributesAndModifiersMatch) return 0;

        let signatureIndex = 0;
        let textBeforeSymbolNameIndex = 0;

        if (attributesAndModifiersMatch.groups?.attributes) {
            const attributes = attributesAndModifiersMatch.groups.attributes;
            symbol.appendToHeader(attributes.trim());

            signatureIndex += attributes.length;
            textBeforeSymbolNameIndex += attributes.length;

            symbol.body = text.substring(attributes.length - 1).trimLeadingEmptyLines();
        }

        if (attributesAndModifiersMatch.groups?.modifiers) {
            const modifiers = attributesAndModifiersMatch.groups.modifiers;

            const accessModifier = CSharpAccessModifier.fromString(modifiers);
            if (accessModifier !== CSharpAccessModifier.none) symbol.accessModifier = accessModifier;

            symbol.memberModifiers = CSharpMemberModifiers.fromString(modifiers);
            textBeforeSymbolNameIndex += modifiers.length;
        }

        if (symbol.canHaveChildren) {
            const openBraceIndex = text.indexOf("{", signatureIndex);
            if (openBraceIndex === -1) throw new Error("Symbol signature does not have an open brace. Please report a issue with example code.");

            const signature = text.substring(signatureIndex, openBraceIndex).trim();
            symbol.appendToHeader(`${signature}\n{`);
            symbol.appendToFooter("}");

            CSharpSymbol.parseImplementations(symbol, signature);
        }

        return textBeforeSymbolNameIndex;
    }

    private static parseCodeBeforeSymbolName(symbol: CSharpSymbol, code: string, tryingAdjustedRange = false): boolean {
        const afterAttributesAndModifiersIndex = CSharpSymbol.parseAttributesAndModifiers(symbol, code);

        const symbolName = symbol.name.includes(".") ? symbol.name.split(".").pop() : symbol.name; // following two lines is a workaround for explicit interface implementations
        const symbolNameIndex = code.indexOfMatch(`(${CSharpPatterns.typeWithGen}\\.)?${symbolName}`, afterAttributesAndModifiersIndex);
        if (symbolNameIndex === -1) return false; // not a failure but rather scenario doesn't apply here

        let codeBeforeSymbolName = "";
        if (afterAttributesAndModifiersIndex === 0 && symbolNameIndex === 0) {
            if (!symbol.range) throw new Error("Symbol declaration that requires special parsing does not have a range. This is not supported. Please report a issue with example code.");
            else if (symbol.range.start.line !== symbol.range.end.line) throw new Error("Symbol declaration that requires special parsing spans multiple lines. This is not supported. Please report a issue with example code.");

            const documentTextLine = symbol.lineAt(symbol.range.start.line);
            if (!documentTextLine) throw new Error("Symbol declaration that requires special parsing does not have a document text line. This is not supported. Please report a issue with example code.");

            const possibleRange = new vscode.Range(new vscode.Position(documentTextLine.range.start.line, documentTextLine.firstNonWhitespaceCharacterIndex), documentTextLine.range.end);
            const adjustedRange = CSharpSymbol.adjustRange(symbol.textDocument!, possibleRange, symbol.type);

            const adjustedRangeBody = symbol.getText(adjustedRange);
            if (!adjustedRangeBody) throw new Error("Symbol declaration that requires special parsing does not have document text of range. This is not supported. Please report a issue with example code.");

            if (possibleRange.isEqual(adjustedRange)) {
                symbol.body = adjustedRangeBody;
                symbol.position = adjustedRange.start;
                symbol.range = adjustedRange;
                return true;
            }
            else if (tryingAdjustedRange) throw new Error("Symbol declaration that requires special parsing did not parse text before symbol name. This is not supported. Please report a issue with example code.");

            return CSharpSymbol.parseCodeBeforeSymbolName(symbol, adjustedRangeBody, true);
        }

        codeBeforeSymbolName = code.substring(afterAttributesAndModifiersIndex, symbolNameIndex - 1).trim();
        if (codeBeforeSymbolName) CSharpSymbol.parseSymbolTypeAndReturnTypeFromCode(symbol, codeBeforeSymbolName);

        return true;
    }

    private static parseImplementations(symbol: CSharpSymbol, signature: string): void {
        if (!signature.includes(":")) return;

        CSharpPatterns.implementsRegExp.lastIndex = 0;

        const implementations = signature.split(":", 2)[1].replace(/\r?\n/g, " ").trim();

        let m;
        while ((m = CSharpPatterns.implementsRegExp.exec(implementations)) !== null) {
            if (!m.groups?.type) continue;
            symbol.implements.push(m.groups.type);
        }
    }

    private static parseNameAndNamespace(symbol: CSharpSymbol): void {
        let name: string | undefined;
        let namespace: string | undefined;

        switch (symbol.type) {
            case CSharpSymbolType.constructor:
            case CSharpSymbolType.staticConstructor:
                const ctorMatch = symbol.fullName.match(`(?<name>${CSharpPatterns.name})\\(`);
                if (ctorMatch?.groups?.name) name = ctorMatch.groups.name;
                break;

            case CSharpSymbolType.finalizer:
                const finalizerMatch = symbol.fullName.match(`~(?<name>${CSharpPatterns.name})\\(`);
                if (finalizerMatch?.groups?.name) name = finalizerMatch.groups.name;
                break;

            case CSharpSymbolType.namespace:
            case CSharpSymbolType.delegate:
            case CSharpSymbolType.interface:
            case CSharpSymbolType.class:
            case CSharpSymbolType.struct:
            case CSharpSymbolType.enum:
            case CSharpSymbolType.recordClass:
            case CSharpSymbolType.recordStruct:
                const match = symbol.fullName.match(`^((?<namespace>(${CSharpPatterns.typeWithGen}\\.)*${CSharpPatterns.typeWithGen})\\.)?(?<name>${CSharpPatterns.typeWithGen})$`);
                if (match?.groups?.name) name = match.groups.name;
                if (match?.groups?.namespace) namespace = match.groups.namespace;
                break;
        }

        if (name) symbol.name = name;
        if (namespace) symbol.namespace = namespace;
    }

    private static parseSymbolTypeAndReturnTypeFromCode(symbol: CSharpSymbol, code: string): void {
        let symbolTypeOnly: string | undefined;
        let symbolTypeWithReturnType: string | undefined;

        let match = code.match(CSharpPatterns.symbolTypeKeywords);
        if (match?.groups?.keywords) {
            // symbol type only
            symbolTypeOnly = match.groups.keywords;

            if (!symbolTypeOnly) throw new Error(`Did not match symbol type: name=\"${symbol.name}\", code=\"${code}\"`);
        }
        else {
            match = code.match(CSharpPatterns.symbolTypeWithReturnTypeKeywords);
            if (match?.groups?.keywords) {
                // symbol type with return type
                symbolTypeWithReturnType = match.groups.keywords;
                match = symbolTypeWithReturnType.match(CSharpPatterns.symbolTypeOnlyWithReturnTypeLast) ?? symbolTypeWithReturnType.match(CSharpPatterns.symbolTypeOnlyWithReturnTypeFirst);
                if (match?.groups?.symbolType) symbolTypeOnly = match.groups.symbolType;
                if (match?.groups?.returnType) symbol.returnType = match.groups.returnType;

                if (!symbolTypeOnly) throw new Error(`Did not match symbol type with return type: name=\"${symbol.name}\", code=\"${code}\"`);
            }
            else {
                symbol.returnType = code;
            }
        }

        if (symbolTypeOnly) symbol.type = CSharpSymbol.symbolTypeFromString(symbolTypeOnly);
    }

    private static positionAtStartOfCodeblock(parentOrFileOpenedPosition: vscode.Position, textDocument: vscode.TextDocument, parentOrFileEndPosition: vscode.Position): vscode.Position {
        let position = new vscode.Position(parentOrFileOpenedPosition.line, parentOrFileOpenedPosition.character);
        if (position.isEqual(CSharpFile.zeroPosition)) return position;

        let c = "";
        do {
            c = textDocument.getText(new vscode.Range(position, position.translate(0, 1)));
            if (c.length === 1) {
                position = position.translate(0, 1);
                if (c === "{" || c === ";") break;
            }
            else position = new vscode.Position(position.line + 1, 0);
        }
        while (position.isBefore(parentOrFileEndPosition));

        return position;
    }

    private static removeStringSpan(symbol: CSharpSymbol, span: StringSpan): void {
        symbol.body = symbol.body.substring(0, span.start) + symbol.body.substring(span.end);
    }

    private static removeStringSpans(symbol: CSharpSymbol, spans: StringSpan[]): void {
        for (let i = spans.length - 1; i >= 0; i--) {
            CSharpSymbol.removeStringSpan(symbol, spans[i]);
        }
    }

    private static stripSymbolAndCommentText(textDocument: vscode.TextDocument, symbols: CSharpSymbol[]): string {
        let documentText = textDocument.getText();

        for (const symbol of [...symbols].reverse()) {
            if (!symbol.range) throw new Error("Symbol does not have a range. This is not supported. Please report a issue with example code.");

            let symbolText = textDocument.getText(symbol.range);
            symbolText = symbolText.replaceAll(CSharpPatterns.nonNewLine, " ");
            documentText = documentText.substring(0, textDocument.offsetAt(symbol.range.start)) + symbolText + documentText.substring(textDocument.offsetAt(symbol.range.end));
        }

        for (const re of [CSharpPatterns.multiLineCommentRegExp, CSharpPatterns.xmlCommentRegExp, CSharpPatterns.singleLineCommentRegExp]) { // [new RegExp("^[ \\t]*///.*?$", "gm")]) { //
            let m;
            while ((m = re.exec(documentText)) !== null) {
                const text = m[0];
                if (!text) continue;

                re.lastIndex = 0; // yes, reset it since we're using it in a loop against a string that is being modified

                const replaced = text.replaceAll(CSharpPatterns.nonNewLine, " ");
                documentText = documentText.substring(0, m.index) + replaced + documentText.substring(m.index + text.length);
            }
        }

        return documentText;
    }

    private static symbolTypeFromDocumentSymbol(documentSymbol: vscode.DocumentSymbol): CSharpSymbolType {
        switch (documentSymbol.kind) {
            case vscode.SymbolKind.Namespace: return CSharpSymbolType.namespace;

            case vscode.SymbolKind.Class: return CSharpSymbolType.class;
            case vscode.SymbolKind.Interface: return CSharpSymbolType.interface;
            case vscode.SymbolKind.Enum: return CSharpSymbolType.enum;
            case vscode.SymbolKind.Struct: return CSharpSymbolType.struct;

            case vscode.SymbolKind.Event: return CSharpSymbolType.event;
            case vscode.SymbolKind.Constant: return CSharpSymbolType.constant;

            case vscode.SymbolKind.Property:
                if (documentSymbol.name.endsWith("this[]")) return CSharpSymbolType.indexer;
                else return CSharpSymbolType.property;

            case vscode.SymbolKind.Field: return CSharpSymbolType.field;

            case vscode.SymbolKind.Constructor: return CSharpSymbolType.constructor;

            case vscode.SymbolKind.Method:
                if (documentSymbol.name === ".ctor") return CSharpSymbolType.constructor;
                else if (documentSymbol.name === "Finalize" && documentSymbol.detail.startsWith("~")) return CSharpSymbolType.finalizer;
                else if (documentSymbol.name === ".cctor") { return CSharpSymbolType.staticConstructor; }
                else { return CSharpSymbolType.method; }

            case vscode.SymbolKind.Operator: return CSharpSymbolType.operator;

            case vscode.SymbolKind.File: return CSharpSymbolType.file;

            default: throw new Error(`Unknown symbol kind: ${vscode.SymbolKind[documentSymbol.kind]} (${documentSymbol.kind})`);
        }
    }

    private static symbolTypeFromString(string: string): CSharpSymbolType {
        switch (string) {
            case "class": return CSharpSymbolType.class;
            case "const": return CSharpSymbolType.constant;
            case "delegate": return CSharpSymbolType.delegate;
            case "enum": return CSharpSymbolType.enum;
            case "event": return CSharpSymbolType.event;
            case "interface": return CSharpSymbolType.interface;
            case "operator": return CSharpSymbolType.operator;
            case "record struct": return CSharpSymbolType.recordStruct;
            case "struct": return CSharpSymbolType.struct;

            case "record":
            case "record class":
                return CSharpSymbolType.recordClass;

            default: throw new Error(`Unknown symbol type string: ${string}`);
        }
    }

    private appendToFooter(text: string): void {
        if (this.footer.length > 0 && !this.footer.endsWith("\n")) this.footer += "\n";
        this.footer += text;
    }

    private appendToHeader(text: string): void {
        if (this.header.length > 0 && !this.header.endsWith("\n")) this.header += "\n";
        this.header += text;
    }

    private getText(range: vscode.Range): string | undefined {
        return this.textDocument?.getText(range);
    }

    private insertOnFooter(text: string): void {
        if (this.footer.length > 0 && !this.footer.startsWith("\n")) this.footer = "\n" + this.footer;
        this.footer = text + this.footer;
    }

    private insertOnHeader(text: string): void {
        if (this.header.length > 0 && !this.header.startsWith("\n")) this.header = "\n" + this.header;
        this.header = text + this.header;
    }

    private isBodyWhitespace(): boolean {
        return this.body.trim().length === 0;
    }

    private lineAt(line: number): vscode.TextLine | undefined {
        return this.textDocument?.lineAt(line);
    }
}
