# Features

## _Sharpen_ C# Files

_Sharpen_ (or organize) C# files by ordering, sorting and regionalizing symbols (i.e. directives, declarations, types and members) by access level, name and type.

## Remove Unused Using Directives

Remove unused `using` directives (either when _sharpening_ a file or using a standalone command).

## Regionalize by Access Modifier and Type

Regionalize symbols by access modifier and/or type (on _sharpen_). Customizable in settings.

## Regionalize Interface Implementations

Regionalize interface implementations by grouping them together within regions (on _sharpen_).

Supported interface implementations: `IAsyncDisposable`, `ICloneable`, `ICollection`, `ICollection<T>`, `IComparable`, `IComparable<T>`, `IConvertible`, `IDisposable`, `IEnumerable`, `IEnumerable<T>`, `IEqualityComparer<T>`, `IEquatable<T>`, `IFormattable`, `IList`, `IList<T>`

Interface implementations grouped by the interface name (less generic type argument list) because of the implementation size: `IAsyncDisposable`, `IDisposable`, `ICollection`, `ICollection<T>`, `IConvertible`, `IList`, `IList<T>`

Interface implementations grouped in a shared `interfaces` region: `ICloneable`, `IComparable`, `IComparable<T>`, `IEnumerable`, `IEnumerable<T>`, `IEqualityComparer<T>`, `IEquatable<T>`, `IFormattable`

Notes:

-   [Explicit interface implementations](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/interfaces/explicit-interface-implementation) _are_ detected and supported.
-   With `IDisposable` and `IAsyncDisposable` the finalizer (i.e. destructor) and possible `/^_?(is)?disposed$/i` (RegExp pattern) boolean instance field are also moved to the region.

## Output File Diagnostics

Output file diagnostics to an output panel. This includes language-specific diagnostics (e.g. syntax, semantic, compiler error/warning).

(Note: This output was used while writing this extension and I decided to keep it in as it may be useful to others.)

# Keyboard Shortcut

_Sharpen_ (organize) current C# file: **⇧**+**⌥**+**⌘**+**f** (macOS) or **shift**+**alt**+**ctrl**+**f** (Windows/Linux)

(Tip: Think **⇧**+**⌥**+**f** (macOS) or **shift**+**alt**+**f** (Windows/Linux) which is for Format Document but with an extra **⌘** (macOS) or **ctrl** (Windows/Linux) for _Sharpen_.)

# Requirements

-   _Uh..._ a C# file. 🤷🏼‍♂️

# Extension Settings

-   `csharpen.removeUnusedUsingsOnSharpen`
    -   Remove unused `using` directives on _sharpen_.
-   `csharpen.showFileSizeDifferenceOnSharpen`
    -   Show the file size difference (in characters) after _sharpening_. This is informational only.
-   `csharpen.formatDocumentOnSharpen`
    -   Perform the format document command before and after _sharpening_.
    -   **WARNING:** Leave this enabled to ensure parsing dependability. Disable only for debugging and advanced purposes.
-   `csharpen.namespaceLevelOrganization`
    -   Namespace-level ordering, sorting and regionalization.
    -   Properties include: `ordering`, `typeSort`, `regionalization`, `regionThreshold`, `doNotRegionalizeMembersOf`, `doNotRegionalizeTypes`, `onlyRegionalizeMembersOf`, `onlyRegionalizeTypes`
    -   Editing settings.json will provide IntelliSense popups to help with setting values.
-   `csharpen.typeLevelOrganization`
    -   Type-level (member and nested type) ordering. sorting and regionalization.
    -   Properties include: `ordering`, `typeSort`, `regionalization`, `regionThreshold`, `doNotRegionalizeMembersOf`, `doNotRegionalizeTypes`, `onlyRegionalizeMembersOf`, `onlyRegionalizeTypes`
    -   Editing settings.json will provide IntelliSense popups to help with setting values.
-   `csharpen.regionalizeInterfaceImplementations`
    -   Regionalize interface implementations by grouping them together within regions.
-   `csharpen.fileFilters`
    -   Filter files (i.e. ignore) by name and content on _sharpen_.
    -   Object array properties include: `name`, `pattern`, `fileName`, `matchLogic`, `reason`, `confirmOnDeny`
    -   Editing settings.json will provide IntelliSense popups to help with setting values.

# Special Handling

The following symbols are specially handled. They are not supported in the settings but are always ordered/sorted in the following:

-   `using` directives:
    -   sorted alphabetically
    -   placed at top
-   `namespace` declarations:
    -   sorted alphabetically
    -   placed after `using` directives

# Known Issues / Limitations

## Program.cs

A `Program.cs` file must contain a `Program` class with a static `Main` method. Top-level statements are not supported. A default file filter is provided to detect this.

## Undo/Redo

Undo/redo _is_ supported but because a format-document command is performed prior-to and after organizing a file, an undo/redo may need to be repeated for each operation. Annoying, I know. 😒 This should be addressed in a subsequent release.

## Preprocessor Directives

First off, within methods, property bodies and enums, preprocessor directives are left alone and preserved.

But... on the namespace level and within types (i.e. wrapped around members), there are considerations to be aware of.

1. `#pragma` directives before and after a type or member _**should**_ be preserved.
2. `#if` and `#endif` directives before and after a type or member _**should**_ be preserved.
3. `#region` and `#endregion` directives are _**not**_ preserved. These are entirely stripped out.
4. Default file filters are provided to detect and ignore files with `#else` and `#elif` directives. If a file is _sharpened_ with these directives outside of methods, property bodies and enums, there are unexpected results. Though, if the directives exist within methods, property bodies and enums, it should be ok. The default file filters have `confirmOnDeny` set to `true` to provide ability to conveniently continue _sharpening_ when detected and you _**know**_ what you're doing.

Lastly, all _sharpening_ modifications can always be undone. If you run into issues, please report them to improve the extension. Better support for preprocessor directives is planned for subsequent releases.

# In-Depth Language Specification

If you're curious, the [C# specification grammar](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/grammar) was referenced when writing this extension to increase the accuracy of parsing and organizing C# files. You may find it interesting to see how the language is defined. I did. 🤓

# Release Notes / Changelog

#### 2024-07-03 — 0.0.3

- Fixed issue with handling `using` directives which subsequently caused issues with handling single-line comments

#### 2024-07-02 — 0.0.2

- Added support for `Program.Main` `Task` return type (via File Filter pattern)
- Fixed issue with handling single-line comments
- Fixed issue with handling attributes
- Updated package dependencies

#### 2024-04-22 — 0.0.1

- Initial release of something functional.
