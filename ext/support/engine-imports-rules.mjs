// The decision of the project check `engine-imports` (ext/checks/engine-imports.mjs), pure: a file's repo-relative path and its text in, the
// forbidden imports out. The law covers the engine (`be/`), the front end (`fe/apps/*/src`, `fe/packages/*/src`) and agent-sdk. No file, no build, no package loaded. This file is no check: it lives in ext/support/ because the harness's R103
// refuses a file of ext/checks/ that ext/manifest.json `checks` does not declare. Concept: .starciwork/concepts/layers.md (the engine holds no
// business), doc ext/docs/checks/engine-imports.md.
//
// Imports are read with the TypeScript compiler API, so a comment or a string that only MENTIONS a package is no import. Every module
// reference form counts: `import`, `import type`, `import x = require()`, `export ... from`, `import("x")` (also as a type), `require("x")`, and the jest calls that name a module (`jest.mock("x")`).
import ts from "typescript"

export const BLOCKS_CORE = "@nivo-lite/blocks-core"
export const NIVO_WEB_CORE = "@nivo-lite/nivo-web-core"
export const PLUGIN_REGISTRY = "@nivo-lite/plugin-registry"

/** The three packages no code outside the roots imports. */
const ALL_FORBIDDEN = [BLOCKS_CORE, NIVO_WEB_CORE, PLUGIN_REGISTRY]

/**
 * The composition roots: the ONLY files that may import the plugin registry (`@nivo-lite/plugin-registry`, and `/client`), by repo-relative
 * path, with the packages each may import. There is no other entry and no allow-list beyond this constant: a file that is not a key here
 * never imports the registry, and no file, root or not, ever imports `@nivo-lite/blocks-core*` or `@nivo-lite/nivo-web-core*`.
 *  - the engine's production root reads the installed plugins once into `INSTALLED`;
 *  - the engine's test root joins a fixture plugin to the real installation for the specs (a spec's `jest.mock("@nivo-lite/plugin-registry", factory)`
 *    REPLACES the root's input and is no import; `jest.requireActual` of the registry belongs to this root only);
 *  - the web app's two modules that re-export what the app reads of the registry: `index.ts` is server-safe (the installation, the graph views, the fixtures, the words), `client.ts` holds the renderers and the card components (React) for client files only.
 */
export const COMPOSITION_ROOTS = {
    "be/src/modules/domain/installed-plugins/installed.policy.ts": [PLUGIN_REGISTRY],
    "be/src/tests/fixtures/builders/installation-parts.builder.ts": [PLUGIN_REGISTRY],
    "fe/apps/web/src/modules/plugin-registry/index.ts": [PLUGIN_REGISTRY],
    "fe/apps/web/src/modules/plugin-registry/client.ts": [PLUGIN_REGISTRY],
}

/** The code extensions read (a JSON or a markdown file imports nothing). */
const CODE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/u

/** A path as git writes it: forward slashes, no leading `./`. */
export const normalizePath = (file) => file.replace(/\\/gu, "/").replace(/^(?:\.\/)+/u, "")

/** The folders the law reaches, as patterns of a normalized path; the first group of each names the folder a finding counts under. */
const FOLDERS = [
    /^(be)\//u,
    /^(fe\/apps\/[^/]+)\/src\//u,
    /^(fe\/packages\/[^/]+)\/src\//u,
    /^(packages\/agent-sdk)\/src\//u,
]

/** The folder a file is counted under in the report (`be`, `fe/apps/web`, `fe/packages/nivo-i18n`, `packages/agent-sdk`); null outside the law. */
export const folderOf = (file) => {
    for (const pattern of FOLDERS) {
        const match = pattern.exec(normalizePath(file))
        if (match !== null) return match[1]
    }
    return null
}

/** The packages a path may not import; null when the law does not reach the file. */
const scopeOf = (file) => {
    if (!CODE_FILE.test(file) || folderOf(file) === null) return null
    if (Object.hasOwn(COMPOSITION_ROOTS, file)) return ALL_FORBIDDEN.filter((name) => !COMPOSITION_ROOTS[file].includes(name))
    return ALL_FORBIDDEN
}

/** The forbidden package a module specifier names (subpath or a relative path into the package folder), or null. */
const forbiddenPackage = (specifier, forbidden) => {
    for (const name of forbidden) {
        if (specifier === name || specifier.startsWith(`${name}/`)) return name
        // A relative reach into the package's own folder is the same dependency by another road.
        const folder = `packages/${name.slice(name.indexOf("/") + 1)}`
        if (/^\.\.?\//u.test(specifier) && `/${specifier}/`.includes(`/${folder}/`)) return name
    }
    return null
}

/** The jest functions whose first argument is a module name. */
const JEST_MODULE_CALLS = new Set(["mock", "doMock", "unmock", "dontMock", "requireActual", "requireMock", "setMock", "createMockFromModule", "unstable_mockModule"])

/** The jest calls that REPLACE a module: a spec that mocks the plugin registry swaps the input of the root, it does not import it. */
const JEST_REPLACING_CALLS = new Set(["mock", "doMock", "unmock", "dontMock", "setMock", "unstable_mockModule"])

const isStringLiteral = (node) => node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))

/** Every module specifier a source file references, as `{ specifier, line }` (1-based line of the specifier). */
export const moduleReferences = (file, text) => {
    const kind = /\.[jt]sx$/u.test(file) ? ts.ScriptKind.TSX : /\.[cm]?js$/u.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
    const found = []
    const add = (node, jestCall = null) => {
        if (!isStringLiteral(node)) return
        found.push({ jestCall, specifier: node.text, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 })
    }
    const visit = (node) => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined) add(node.moduleSpecifier)
        else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node.moduleReference.expression)
        else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) add(node.argument.literal)
        else if (ts.isCallExpression(node) && node.arguments.length > 0) {
            const callee = node.expression
            const isImportCall = callee.kind === ts.SyntaxKind.ImportKeyword
            const isRequire = ts.isIdentifier(callee) && callee.text === "require"
            // jest.mock("pkg", ...) and its siblings bind a package by name exactly as an import does.
            const isJestModule =
                ts.isPropertyAccessExpression(callee) &&
                ts.isIdentifier(callee.expression) &&
                callee.expression.text === "jest" &&
                JEST_MODULE_CALLS.has(callee.name.text)
            if (isJestModule) add(node.arguments[0], callee.name.text)
            else if (isImportCall || isRequire) add(node.arguments[0])
        }
        ts.forEachChild(node, visit)
    }
    visit(source)
    return found
}

/**
 * The findings of one file: `{ file, line, package }` for each forbidden import, in source order. `file` may use Windows or POSIX
 * separators; it is read relative to the app root.
 */
export const engineImportFindings = (file, text) => {
    const path = normalizePath(file)
    const forbidden = scopeOf(path)
    if (forbidden === null) return []
    return moduleReferences(path, text).flatMap(({ specifier, line, jestCall }) => {
        const name = forbiddenPackage(specifier, forbidden)
        if (name === null) return []
        // `jest.mock("@nivo-lite/plugin-registry", factory)` replaces what the root reads; only that package, and only by a replacing call.
        if (name === PLUGIN_REGISTRY && jestCall !== null && JEST_REPLACING_CALLS.has(jestCall)) return []
        return [{ file: path, line, package: name }]
    })
}

/** One line per finding: `file:line  package`. */
export const findingLine = (finding) => `${finding.file}:${finding.line}  ${finding.package}`

/** The count of findings per folder (`be`, `fe/apps/web`, `packages/agent-sdk`...), for the closing summary. */
export const countsByFolder = (findings) => {
    const counts = {}
    for (const finding of findings) counts[folderOf(finding.file)] = (counts[folderOf(finding.file)] ?? 0) + 1
    return counts
}

/** The count of findings per forbidden package, for the closing summary. */
export const countsByPackage = (findings) => {
    const counts = {}
    for (const finding of findings) counts[finding.package] = (counts[finding.package] ?? 0) + 1
    return counts
}
