## β Beta

#### 2025-01-24 — 0.2.1

- Fixed issue with properly structuring parent-to-child hierarchy of symbols.

#### 2025-01-19 — 0.2.0

- Added ability to sharpen all files in a project.
- Added ability to output file diagnostics for all files in a project.

#### 2025-01-18 — 0.1.0

- Added feature to enforce use of file-scoped namespaces on _sharpen_. This can be toggle in settings.
- Upgraded to beta since there has been a lot of recent changes and fixes, and I use it heavily in my daily work and find it quite stable (and useful).

## ⍺ Alpha

#### 2025-01-18 — 0.0.13

- Fixed issue when detecting and creating non-code blocks, i.e. comments. It was too aggressive and behavior would be that comments from down below would be pulled up to top symbols. Using a primary constructor could induce this.

#### 2025-01-17 — 0.0.12

- Fixed issue with having multiple attributes

#### 2025-01-17 — 0.0.11

- Fixed issue with nested classes (credit: [Kali Toste](https://github.com/Clayton-Toste))

#### 2025-01-17 — 0.0.10

- Fixed issue with character at position 0:0 being trimmed

#### 2024-12-24 — 0.0.9

- Added setting to control whether sharpening can happen with a file that has diagnostic errors

#### 2024-07-28 — 0.0.8

- Made sure all settings have defaults.

#### 2024-07-27 — 0.0.7

- Fixed issue with handling classes outside of namespaces
- Fixed issues introduced by the previous release regarding "maximum call stack size exceeded" errors

#### 2024-07-27 — 0.0.6

- Fixed issue with handling `event` declarations

#### 2024-07-11 — 0.0.5

- Added output of Quick Fixes to the `Output File Diagnostics` command

#### 2024-07-04 — 0.0.4

- Fixed minor issue with handling attributes

#### 2024-07-03 — 0.0.3

- Fixed issue with handling `using` directives which subsequently caused issues with handling single-line comments

#### 2024-07-02 — 0.0.2

- Added support for `Program.Main` `Task` return type (via File Filter pattern)
- Fixed issue with handling single-line comments
- Fixed issue with handling attributes
- Updated package dependencies

#### 2024-04-22 — 0.0.1

- Initial release of something functional.
