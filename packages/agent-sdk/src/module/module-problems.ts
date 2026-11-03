import type { BlockDefinition } from "../block/block.types"
import type { SpecBindings } from "../spec/spec"
import { specProblems } from "../spec/spec"
import type { ModuleDocument, ModuleProblem } from "./module-document.types"

/** The module key rule of the catalogue. */
const MODULE_KEY = /^[a-z][a-z0-9_]{1,23}$/

/** The longest changelog the update offer shows. */
export const MODULE_CHANGELOG_MAX = 600

/** The intent that runs a gateway call and belongs to no authority action. */
const GATEWAY_INTENT = "gateway_call"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Whether an object is a bilingual text: exactly the two product languages as strings. */
const isBilingual = (
    value: Readonly<Record<string, unknown>>,
): value is { readonly vi: string; readonly en: string } => {
    const names = Object.keys(value)
    return names.length === 2 && typeof value.vi === "string" && typeof value.en === "string"
}

/** The paths of every bilingual text with a blank language, anywhere in a value. */
const blankLanguages = (value: unknown, at: string): ReadonlyArray<string> => {
    if (Array.isArray(value)) return value.flatMap((item, index) => blankLanguages(item, `${at}[${index}]`))
    if (!isRecord(value)) return []
    if (isBilingual(value)) return value.vi.trim() === "" || value.en.trim() === "" ? [at] : []
    return Object.entries(value).flatMap(([name, item]) => blankLanguages(item, `${at}.${name}`))
}

/** The problems of the identity fields of a document. */
const identityProblems = (doc: ModuleDocument): ReadonlyArray<ModuleProblem> => {
    const problems: Array<ModuleProblem> = []
    if (!MODULE_KEY.test(doc.key)) problems.push({ code: "MODULE_KEY_MALFORMED", at: "key" })
    if (!Number.isInteger(doc.version) || doc.version < 1)
        problems.push({ code: "MODULE_VERSION_INVALID", at: "version" })
    if (doc.changelog.length > MODULE_CHANGELOG_MAX)
        problems.push({ code: "MODULE_CHANGELOG_TOO_LONG", at: "changelog" })
    return problems
}

/** The problems of the template: duplicate actions, a command or an intent naming an action the module does not govern. */
const templateProblems = (doc: ModuleDocument): ReadonlyArray<ModuleProblem> => {
    const problems: Array<ModuleProblem> = []
    const actions = new Set<string>()
    for (const action of doc.template.authorityActions) {
        if (actions.has(action.action)) problems.push({ code: "MODULE_ACTION_DUPLICATE", at: action.action })
        actions.add(action.action)
    }
    for (const command of doc.template.accepts)
        if (!actions.has(command.action))
            problems.push({ code: "MODULE_COMMAND_UNKNOWN_ACTION", at: `${doc.key}.${command.command}` })
    for (const intent of doc.contracts.intents)
        if (intent.intent !== GATEWAY_INTENT && !actions.has(intent.intent))
            problems.push({ code: "MODULE_INTENT_UNKNOWN_ACTION", at: `${doc.key}.${intent.intent}` })
    return problems
}

/** The problems of every workbench spec: `main` present, the spec of this module, and each spec valid against the blocks. */
const workbenchProblems = (
    doc: ModuleDocument,
    blocks: ReadonlyArray<BlockDefinition>,
    bindings: SpecBindings,
): ReadonlyArray<ModuleProblem> => {
    const problems: Array<ModuleProblem> = []
    if (doc.workbenches.main === undefined)
        problems.push({ code: "MODULE_WORKBENCH_MAIN_MISSING", at: "workbenches.main" })
    for (const [route, spec] of Object.entries(doc.workbenches)) {
        const at = `workbenches.${route}`
        if (spec.module !== doc.key) problems.push({ code: "MODULE_WORKBENCH_FOREIGN", at })
        for (const problem of specProblems(spec, blocks, bindings))
            problems.push({ code: "MODULE_SPEC_PROBLEM", at: `${at}:${problem.at}`, detail: problem.code })
    }
    return problems
}

/**
 * What is wrong with a module document, empty when the host may seed it: a well-formed key, version and changelog, both product
 * languages in every text, a `main` workbench of its own key, commands and intents that name actions of the module, and every
 * workbench spec valid against the installed blocks (and the reads and actions, when the host gives them).
 */
export const moduleProblems = (
    doc: ModuleDocument,
    blocks: ReadonlyArray<BlockDefinition>,
    bindings: SpecBindings = {},
): ReadonlyArray<ModuleProblem> => [
    ...identityProblems(doc),
    ...blankLanguages({ manifest: doc.manifest, template: doc.template, contracts: doc.contracts }, "doc").map(
        (at): ModuleProblem => ({ code: "MODULE_TEXT_LANGUAGE_MISSING", at }),
    ),
    ...templateProblems(doc),
    ...workbenchProblems(doc, blocks, bindings),
]
