<h1 align="center">
    <p><img src="https://github.com/kokoabim/vscode-csharpen/blob/main/images/extension-512.png?raw=true" alt="logo" width="240"></p>
    <p>CSharpen</p>
</h1>
<h3 align="center">C# File Organizer</h3>
<p align="center">Order, sort and regionalize symbols by access level, name and type, and other features to keep your C# files <span style="font-weight:bold;font-style:italic;">sharp</span>.</p>
<p align="center"><a href="https://marketplace.visualstudio.com/items?itemName=spencerjames.csharpen"><img src="https://vsmarketplacebadges.dev/version/spencerjames.csharpen.svg?label=CSharpen"></a></p>

# Features

-   Order, sort and regionalize symbols by access level, name and type.
-   Remove unused `using` directives.
-   Remove unused package references (NuGet) of one or more projects in a solution.
-   Perform Quick Fixes.
-   Apply coding styles.
-   Rename symbols by convention.
-   Regionalize interface implementations.
-   Output File Diagnostics and Quick Fixes.

### Keyboard shortcut

-   Current file: **⇧**+**⌥**+**⌘**+**f** on macOS, **shift**+**alt**+**ctrl**+**f** on Windows/Linux
-   Tip: Think Format Document command, which is **⇧**+**⌥**+**f** on macOS or **shift**+**alt**+**f** on Windows/Linux, but add **⌘** on macOS or **ctrl** on Windows/Linux.

### Commands

-   Current file: "Sharpen Document" (`kokoabim.csharpen.sharpen-file`)
-   Project files: "Sharpen All Files In Project..." (`kokoabim.csharpen.sharpen-project-files`)

See Features -> Commands for more.

# Remove Unused Package References

Remove unused package references (NuGet) from one or more projects. For all C# files of the projects being processed, unused `using` directives will be removed and, if enabled, the file will be _sharpened_ (setting: `csharpen.sharpenFilesWhenRemovingUnusedReferences`).

Command: "Remove Unused References Of Project..." (`kokoabim.csharpen.remove-unused-references`)

### Known Issue

It is possible that _used_ `using` directives are removed. This is due to VS Code incorrectly indicating that a `using` directive is not used (by way of its `vscode.languages.getDiagnostics(Uri):Diagnostic[]` API). The setting `csharpen.delayBeforeRemovingUnusedUsingDirectives` adds a delay after showing the file in the editor which may help with this issue though adds time to the overall process.

Note: If this occurs, use the Quick Fix to re-edd the `using` directive. (**⌘**+**.** on macOS or **ctrl**+**.** on Windows/Linux)

# Remove Unused Using Directives

Remove unused `using` directives (either when _sharpening_ a file, removing unused package references or using a standalone command).

Stand-alone command: "Remove Unused Using Declarations" (`kokoabim.csharpen.remove-unused-usings`)

# Perform Quick Fixes

Based on configurable Quick Fix title patterns, performs all matched Quick Fixes for the current file. Can be invoked by command (`Perform Quick Fixes`) or when _sharpening_ a file by setting `csharpen.performQuickFixesOnSharpen` to `true` (`false` by default). Whether enabled or not, not invoked when processing all project files.

See settings for default patterns. More default patterns can be added in future releases.

# Coding Styles

Apply coding styles using a command ("Apply Coding Styles") or when _sharpening_ (by setting `csharpen.codingStylesEnabled` to `true`).

### Current Coding Styles

| Setting                                               | Description                                                                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `csharpen.convertNonPrivateFieldsToProperties`        | Convert non-private fields to properties. Preserves value assignment (if any).                                                           |
| `csharpen.useLanguageKeywordsInsteadOfFrameworkTypes` | Change BCL/Framework types to language keywords on return and member types. Example: `System.String` to `string`, `Int32` to `int`, etc. |

Individual rules can be disabled in settings. By default all rules are enabled.

### Future Coding Styles

On subsequent releases, additional rules will be added.

# Symbol Renaming

Based on configurable logic and patterns, symbols can be renamed on _sharpen_. The renaming operation uses VS Code's built-in rename functionality thus all references in other files are renamed as well.

An example use case (and a default setting): All methods that (1) include a member modifier of `async`, (2) have a return type of `Task` or `ValueTask` (with or without generic type arguments) and (3) the symbol name does _not_ end with `Async` are renamed to _have_ a suffix of `Async`.

See settings: `csharpen.symbolRenamingEnabled` and `csharpen.symbolRenaming`.

# Regionalize by Access Modifier and Type

Regionalize symbols by access modifier and/or type on _sharpen_. Customizable in settings.

# Regionalize Interface Implementations

Regionalize interface implementations by grouping them together within regions on _sharpen_.

Supported interface implementations:

-   `IAsyncDisposable`, `IDisposable`
-   `ICloneable`
-   `ICollection`, `ICollection<T>`
-   `IComparable`, `IComparable<T>`
-   `IConvertible`
-   `IEnumerable`, `IEnumerable<T>`
-   `IEqualityComparer<T>`
-   `IEquatable<T>`
-   `IFormattable`
-   `IList`, `IList<T>`

Interface implementations grouped by the interface name (without generic type argument list) because of the implementation size:

-   `IAsyncDisposable`, `IDisposable`
-   `ICollection`, `ICollection<T>`
-   `IConvertible`
-   `IList`, `IList<T>`

Interface implementations grouped in a shared `interfaces` region:

-   `ICloneable`
-   `IComparable`, `IComparable<T>`
-   `IEnumerable`, `IEnumerable<T>`
-   `IEqualityComparer<T>`,
-   `IEquatable<T>`
-   `IFormattable`

Notes:

-   [Explicit interface implementations](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/interfaces/explicit-interface-implementation) _are_ detected and supported.
-   With `IDisposable` and `IAsyncDisposable` the finalizer (i.e. destructor) and possible `/^_?(is)?disposed$/i` (RegExp pattern) boolean instance field are also moved to the region.

# Output File Diagnostics and Quick Fixes

Output File Diagnostics and Quick Fixes to output panel. This includes language-specific diagnostics (e.g. syntax, semantic, compiler error/warning) and what Quick Fixes are available.

Commands:

-   Current file: "Output File Diagnostics" (`kokoabim.csharpen.output-file-diagnostics`)
-   Project files: "Output File Diagnostics For All Files In Project..." (`kokoabim.csharpen.output-file-diagnostics-for-project-files`)

# Requirements

-   _Uh..._ a C# file. 🤷🏼‍♂️

# Special Handling

The following symbols are specially handled. They are not supported in the settings but are always ordered/sorted in the following:

-   `using` directives:
    -   sorted alphabetically
    -   placed at top
    -   unused `using` directives are removed (setting `csharpen.removeUnusedUsingsOnSharpen`)
-   `namespace` declarations:
    -   sorted alphabetically
    -   placed after `using` directives
    -   if one exists, converted to a file-scoped namespace (setting `csharpen.enforceFileScopedNamespaces`)

# Known Issues / Limitations

## Program.cs

A `Program.cs` file must contain a `Program` class with a static `Main` method. Top-level statements are not supported. A default file filter is provided to detect this.

## Undo/Redo

Undo/redo _is_ supported but because a Format Document command is performed prior-to and after organizing a file, an undo/redo may need to be repeated for each operation. Annoying, I know. 😒

## Preprocessor Directives

First off, within methods, property bodies and enums, preprocessor directives are left alone and preserved.

But... on the namespace level and within types (i.e. wrapped around members), there are considerations to be aware of.

1. `#pragma` directives before and after a single type or member _**should**_ be preserved.
2. `#if` and `#endif` directives before and after a single type or member _**should**_ be preserved.
3. `#region` and `#endregion` directives are _**not**_ preserved. These are entirely stripped out.
4. Default file filters are provided to detect and ignore files with `#else` and `#elif` directives. If a file is _sharpened_ with these directives outside of methods, property bodies and enums, there are unexpected results. Though, if the directives exist within methods, property bodies and enums, it should be ok. The default file filters have `confirmOnDeny` set to `true` to provide ability to conveniently continue _sharpening_ when detected and you _**know**_ what you're doing.

Note: All _sharpening_ modifications can always be undone.

# In-Depth Language Specification

If you're curious, the [C# specification grammar](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/grammar) was referenced when writing this extension to increase the accuracy of parsing and organizing C# files. You may find it interesting to see how the language is defined. I did. 🤓
