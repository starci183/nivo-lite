// Helpers shared by the project lint rules of ext/lint/ (each file there is ONE ESLint rule that ext/manifest.json declares; the harness
// loads it under the plugin `project-ext`, and so does ext/support/lint-config.mjs). This file is no rule: it lives in ext/support/ because the
// harness refuses a file of ext/lint/ that no rule declares. Each rule imports it by relative path. Structural only: paths, import bindings, AST shapes
// and the id grammar of a NIVO verb. No list of words decides a meaning here.
import { dirname, isAbsolute, relative, resolve, posix } from "node:path"
import { fileURLToPath } from "node:url"

/** The app root (the lane): ext/support/../.. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

/**
 * The law of a NIVO verb, copied from `packages/agent-sdk/src/schema/namespaced.ts` (`NIVO_VERB`, read 2026-11-13):
 * `nivo.<level>.<1–4 kebab-case segments>`, level `api | tool | trigger`. ext/tests/tool-ids-from-names.spec.mjs proves the copy
 * equals the built SDK's `levelOf` when the SDK is built. Keep the two in step.
 */
export const NIVO_VERB = /^nivo\.(api|tool|trigger)((\.[a-z][a-z0-9-]*){1,4})$/

/** The start of a NIVO verb, for a template literal built from text (`nivo.tool.${x}`): the same grammar's head. */
export const NIVO_VERB_HEAD = /^nivo\.(api|tool|trigger)\./

/** The entries a NIVO name constant (`TOOL`, `TRIGGER`, `API`, `PROVIDER`) is imported from: the SDK's names entry and its re-exports. */
export const NAMES_SOURCES = new Set(["@nivo-lite/agent-sdk/names", "@nivo-lite/agent-sdk", "@nivo-lite/blocks-core"])

/** The entry of the template builders (`defineTemplateGraph`, `node`, `loop`, `ref`, the expression builders ...). */
export const TEMPLATE_SOURCE = "@nivo-lite/agent-sdk/template"

/** Whether an import source is a generated names file (`./vocabulary/crm-tool-names.generated`): the generator's file suffix. */
export const isGeneratedSource = (source) => /\.generated(\.[cm]?[jt]sx?)?$/.test(source)

/** The file of the rule's context as a posix path relative to ROOT, or null when it lies outside ROOT. */
export const relOf = (context) => {
    const file = context.filename ?? context.getFilename()
    if (!isAbsolute(file)) return file.split("\\").join("/")
    const rel = relative(ROOT, file)
    if (rel.startsWith("..") || isAbsolute(rel)) return null
    return rel.split("\\").join("/")
}

/** Whether a root-relative posix path matches one of the globs. */
export const matchesAny = (rel, globs) => rel !== null && globs.some((glob) => posix.matchesGlob(rel, glob))

/** An expression without its TypeScript wrappers (`as`, `satisfies`, `!`, `<T>x`). */
export const unwrap = (node) => {
    let current = node
    while (
        current &&
        (current.type === "TSAsExpression" ||
            current.type === "TSSatisfiesExpression" ||
            current.type === "TSNonNullExpression" ||
            current.type === "TSTypeAssertion" ||
            current.type === "TSInstantiationExpression")
    )
        current = current.expression
    return current
}

/**
 * The value imports of a file: local name → { imported, source }. A type-only import (`import type`, `type X`) is no binding of a value.
 * Filled by the `ImportDeclaration` visitor `collectImports` returns; read after it ran (imports precede their uses).
 */
export const importBindings = () => {
    const bindings = new Map()
    const visit = (declaration) => {
        if (declaration.importKind === "type") return
        const source = declaration.source.value
        for (const specifier of declaration.specifiers) {
            if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue
            const imported =
                specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value
            bindings.set(specifier.local.name, { imported, source, node: specifier })
        }
    }
    return { bindings, visit }
}

/** The imported name an identifier callee is bound to (`node(...)` → "node"), or null. */
export const calleeImport = (bindings, call) => {
    const callee = unwrap(call.callee)
    if (callee?.type !== "Identifier") return null
    return bindings.get(callee.name) ?? null
}

/** Whether an expression is `X.member` (or `X["member"]`) on an identifier bound to an import named `name` from a names source. */
export const isNamesMember = (bindings, expression, name) => {
    const node = unwrap(expression)
    if (node?.type !== "MemberExpression") return false
    const object = unwrap(node.object)
    if (object?.type !== "Identifier") return false
    const binding = bindings.get(object.name)
    return binding !== undefined && binding.imported === name && NAMES_SOURCES.has(binding.source)
}

/** The path of the concept topic file a rule cites (`.starciwork/concepts/<topic>.md`). */
export const conceptOf = (topic) => `.starciwork/concepts/${topic}.md`
