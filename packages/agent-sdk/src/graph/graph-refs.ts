import { isRecord } from "../schema/is-record"
import { isInputRef, TRIGGER_SOURCE, type NodeInputBinding, type NodeInputBindings } from "../node/binding"
import { fixedParamsOf, isParamRef, paramRefsOf, parseRef, schemaKeysOf } from "../node/memory"
import {
    LEAD_FACTS,
    LOOP_INDEX_MEMBER,
    LOOP_ITEMS_PARAM,
    OUTCOME_PARAM,
    OUTCOME_STEP,
    type NodeOutcomeDeclaration,
    type ParamBindings,
    type ParamRef,
    type ParsedRef,
    type RefProblem,
    type RefProblemCode,
    type RefType,
    type RefValidationContext,
} from "../node/memory.contracts"
import type { NodeIndex } from "../node/problems"
import { dominatorsOf, loopBodiesOf, loopOfNode, outcomeOfNode, reaches, type DominatorMap } from "./graph-dominators"
import {
    branchesOf,
    failureSchemaOf,
    fits,
    jsonSchemaOf,
    MISSING,
    schemaAt,
    typeOfSchema,
    UNTYPED,
    type Json,
} from "./graph-ref-schema"
import type { GraphSpec, GraphSpecNode } from "./graph-spec.types"

/** The members of a trigger scope every run has, whatever the workflow's contract: the engine's own (`triggerScopeOf`). */
export const TRIGGER_SYSTEM_MEMBERS: ReadonlyArray<string> = [
    "conversationId",
    // The engine's person: the contact the channel's identity resolved to (contacts.md).
    "contactId",
    // The sales module's lead the conversation names: a module bridge member until that module reads its lead by `contactId`.
    "leadId",
    "subject",
    "locale",
    "origin",
    "source",
    "tagSource",
    "text",
    "messageId",
    "messageIds",
    "mergedMessageIds",
    "actorMemberId",
    "authorAgentId",
    "channel",
    "caller",
    "triggerKey",
]

/** The members of `trigger.caller` on a run another workflow called: who called it. */
const CALLER_MEMBERS: Readonly<Record<string, RefType>> = { agent: "string", workflow: "string", runId: "string" }

/** The step of the end hand-off: its `inputs` are typed by the target's contract, checked in the back end at publish. */
const CALL_WORKFLOW_STEP = "core.call-workflow"

/** The params member of the hand-off whose members the target's contract types. */
const HANDOFF_INPUTS = "inputs"

/** The params member of an outcome step whose members the outcome's declared outputs type, checked by the contracts lane. */
const OUTCOME_OUTPUTS = "outputs"

/** The lead facts, for a quick check of `lead.*`. */
const LEAD_FACT_SET: ReadonlySet<string> = new Set(LEAD_FACTS)

/** The catalog key of a problem's words: `workflowRef.<lowerCamel code>`. */
export const refMessageKeyOf = (code: RefProblemCode): string =>
    `workflowRef.${code.toLowerCase().replaceAll(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())}`

/**
 * The words of a problem from a catalog of words keyed by `refMessageKeyOf` (`workflowRef.refNotDominator`); `{{node}}`, `{{field}}`,
 * `{{ref}}`, `{{expected}}` and `{{found}}` are filled in. The catalogs live with the back end's messages, not in the SDK.
 */
export const refProblemText = (problem: RefProblem, words: Readonly<Record<string, string>>): string =>
    (words[problem.messageKey] ?? problem.messageKey).replaceAll(
        /\{\{(\w+)\}\}/g,
        (_, name: string) => problem.params[name] ?? "",
    )

// ---------------------------------------------------------------------------------------------------------------------------------
// The problems
// ---------------------------------------------------------------------------------------------------------------------------------

/** The context of the refs of a spec from the installed nodes, the other workflows of the workspace and the spec's input contract. */
export const refContextOf = (
    index: NodeIndex,
    workflows: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map(),
    trigger: Readonly<Record<string, RefType>> = {},
    workflowOutcomes: ReadonlyMap<string, Readonly<Record<string, RefType>>> = new Map(),
): RefValidationContext => ({
    workflowOutcomes,
    outcomes: new Map(
        [...index.nodes].map(([id, node]) => [
            id,
            { output: node.output, failure: node.failure, facts: node.facts, sensitive: node.sensitive },
        ]),
    ),
    params: new Map([...index.nodes].map(([id, node]) => [id, node.params])),
    inputs: new Map([...index.nodes].map(([id, node]) => [id, node.input])),
    workflows,
    trigger,
})

/**
 * The context of a spec from the installed nodes and the spec itself: the trigger typed by its input contract, the outcomes by their
 * declared outputs. `workflows` names the other workflows of the workspace for `workflows.*` refs; without it (a pure check, the seed)
 * such a ref is judged only for its default.
 */
export const specRefContextOf = (
    spec: GraphSpec,
    index: NodeIndex,
    workflows: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map(),
): RefValidationContext =>
    refContextOf(
        index,
        workflows,
        Object.fromEntries((spec.contract?.inputs ?? []).map((input) => [input.name, input.type])),
        new Map(
            (spec.outcomes ?? []).map((outcome) => [
                outcome.key,
                Object.fromEntries(outcome.outputs.map((output) => [output.name, output.type])),
            ]),
        ),
    )

interface Site {
    readonly node: GraphSpecNode
    readonly field: string
    readonly ref: ParamRef
    /** The param's type, `unknown` for a nested member. */
    readonly expected: RefType
}

/** What the judging of one ref site needs. */
interface SiteCheck {
    readonly spec: GraphSpec
    readonly site: Site
    readonly parsed: ParsedRef
    readonly context: RefValidationContext
    readonly dominators: DominatorMap
}

const problemOf = (
    code: RefProblemCode,
    node: GraphSpecNode,
    field: string,
    ref: string | null,
    extra: Readonly<Record<string, string>> = {},
): RefProblem => ({
    code,
    nodeKey: node.key,
    field,
    ref,
    messageKey: refMessageKeyOf(code),
    params: { node: node.key, field, ref: ref ?? "", ...extra },
})

/** The params a node writes. */
const paramsOfNode = (node: GraphSpecNode): ParamBindings => node.params ?? {}

/** The type of a param of a node, from whichever of its two schemas has it; null when neither does (or both take anything). */
const paramTypeOf = (context: RefValidationContext, node: GraphSpecNode, field: string): RefType | null => {
    for (const schema of [context.params.get(node.step), context.inputs.get(node.step)]) {
        if (schema === undefined || schemaKeysOf(schema)?.has(field) === false) continue
        const found = schemaAt(jsonSchemaOf(schema, "input"), [field])
        if (found === UNTYPED) return "unknown"
        if (found !== MISSING) return typeOfSchema(found)
    }
    return null
}

/** The legacy input bindings of a node as refs of the new grammar: `<nodeKey>.<path>` reads `steps.<nodeKey>.output.<path>`. */
const legacySitesOf = (node: GraphSpecNode, context: RefValidationContext): ReadonlyArray<Site> => {
    const inside = (binding: NodeInputBinding): ReadonlyArray<string> => {
        if (isInputRef(binding)) return [binding.$ref]
        if (typeof binding !== "object" || binding === null) return []
        return Object.values(binding).flatMap((entry) => inside(entry))
    }
    const bindings: NodeInputBindings = node.input ?? {}
    return Object.entries(bindings).flatMap(([field, binding]) =>
        inside(binding).map((text): Site => {
            const [source = "", ...path] = text.split(".")
            const modern =
                parseRef(text) !== null || source === TRIGGER_SOURCE
                    ? text
                    : ["steps", source, "output", ...path].join(".")
            return {
                node,
                field,
                ref: { $ref: modern },
                expected: isInputRef(binding) ? (paramTypeOf(context, node, field) ?? "unknown") : "unknown",
            }
        }),
    )
}

/** The params member of a step whose members another contract types, so its refs are not typed by the member itself. */
const mappedFieldOf = (step: string): string | null => {
    if (step === CALL_WORKFLOW_STEP) return HANDOFF_INPUTS
    return step === OUTCOME_STEP ? OUTCOME_OUTPUTS : null
}

/** Every ref site of a node: each ref of its params (typed when it is the whole param) and of its legacy input. */
const sitesOf = (node: GraphSpecNode, context: RefValidationContext): ReadonlyArray<Site> => {
    const params = paramsOfNode(node)
    const mapped = mappedFieldOf(node.step)
    return [
        ...paramRefsOf(params).map(
            ({ field, ref }): Site => ({
                node,
                field,
                ref,
                expected:
                    isParamRef(params[field]) && field !== mapped
                        ? (paramTypeOf(context, node, field) ?? "unknown")
                        : "unknown",
            }),
        ),
        ...legacySitesOf(node, context),
    ]
}

/** The params of a node its schemas do not know: none when either schema takes any member. */
const unknownParamsOf = (
    params: ParamBindings,
    known: ReadonlyArray<ReadonlySet<string> | null>,
): ReadonlyArray<string> => {
    if (known.includes(null)) return []
    return Object.keys(params).filter((name) => !known.some((keys) => keys?.has(name) === true))
}

/** The problems of the params a node writes: a member neither of its node's schemas has, a fixed value its params schema refuses. */
const paramProblems = (node: GraphSpecNode, context: RefValidationContext): ReadonlyArray<RefProblem> => {
    const settings = context.params.get(node.step)
    const inputs = context.inputs.get(node.step)
    if (settings === undefined) return []
    const params = paramsOfNode(node)
    const settingKeys = schemaKeysOf(settings)
    const unknown = unknownParamsOf(params, [settingKeys, inputs === undefined ? new Set<string>() : schemaKeysOf(inputs)])
    const fixed = Object.fromEntries(
        Object.entries(fixedParamsOf(params)).filter(([name]) => settingKeys === null || settingKeys.has(name)),
    )
    const unbound = new Set(
        paramRefsOf(params)
            .filter(({ ref }) => ref.default === undefined)
            .map(({ field }) => field),
    )
    const parsed = settings.safeParse(fixed)
    const invalid = parsed.success
        ? []
        : [
              ...new Set(
                  parsed.error.issues
                      .map((issue) => String(issue.path[0] ?? ""))
                      .filter((name) => !unbound.has(name) && !unknown.includes(name)),
              ),
          ]
    return [
        ...unknown.map((field) => problemOf("PARAM_UNKNOWN", node, field, null)),
        ...invalid.map((field) => problemOf("PARAM_INVALID", node, field === "" ? "*" : field, null)),
    ]
}

/** The problem of an outcome step naming an outcome the workflow does not declare (judged once the workflow declares any). */
const outcomeProblems = (node: GraphSpecNode, context: RefValidationContext): ReadonlyArray<RefProblem> => {
    if (node.step !== OUTCOME_STEP || context.workflowOutcomes === undefined || context.workflowOutcomes.size === 0) return []
    const outcome: unknown = node.params?.[OUTCOME_PARAM]
    return typeof outcome === "string" && context.workflowOutcomes.has(outcome)
        ? []
        : [problemOf("OUTCOME_UNKNOWN", node, OUTCOME_PARAM, typeof outcome === "string" ? outcome : "")]
}

const sayOf = (check: SiteCheck, code: RefProblemCode, extra?: Readonly<Record<string, string>>): RefProblem =>
    problemOf(code, check.site.node, check.site.field, check.site.ref.$ref, extra)

/** The problem of the schema a ref reads not fitting the param that holds it. */
const typedAs = (check: SiteCheck, schema: Json): RefProblem | null => {
    if (schema === MISSING) return sayOf(check, "REF_FIELD_UNKNOWN")
    const found = typeOfSchema(schema)
    return fits(check.site.expected, found) ? null : sayOf(check, "REF_TYPE_MISMATCH", { expected: check.site.expected, found })
}

/** `trigger.caller`, whose members are who called the run. */
const callerProblem = (check: SiteCheck): RefProblem | null => {
    const [, inner] = check.parsed.path
    if (inner === undefined) return typedAs(check, { type: "object" })
    const type = CALLER_MEMBERS[inner]
    return type === undefined || check.parsed.path.length > 2 ? sayOf(check, "REF_FIELD_UNKNOWN") : typedAs(check, { type })
}

const triggerProblem = (check: SiteCheck): RefProblem | null => {
    const [member] = check.parsed.path
    if (member === "caller") return callerProblem(check)
    if (member === undefined || TRIGGER_SYSTEM_MEMBERS.includes(member)) return null
    const declared = check.context.trigger[member]
    if (declared === undefined) return Object.keys(check.context.trigger).length === 0 ? null : sayOf(check, "REF_FIELD_UNKNOWN")
    return check.parsed.path.length === 1 ? typedAs(check, { type: declared }) : null
}

const outProblem = (check: SiteCheck): RefProblem | null => {
    const outcome = outcomeOfNode(check.spec, check.site.node.key, check.dominators)
    if (outcome === null) return sayOf(check, "REF_OUT_OUTSIDE_OUTCOME")
    const fields = check.context.workflowOutcomes?.get(outcome)
    const [member] = check.parsed.path
    if (fields === undefined || member === undefined) return null
    const type = fields[member]
    if (type === undefined) return sayOf(check, "REF_FIELD_UNKNOWN")
    return check.parsed.path.length === 1 ? typedAs(check, { type }) : null
}

const itemProblem = (check: SiteCheck): RefProblem | null => {
    const { spec, context, parsed } = check
    const loopKey = loopOfNode(spec).get(check.site.node.key)
    if (loopKey === undefined) return sayOf(check, "REF_ITEM_OUTSIDE_LOOP")
    if (parsed.path[0] === LOOP_INDEX_MEMBER)
        return parsed.path.length === 1 ? typedAs(check, { type: "integer" }) : sayOf(check, "REF_FIELD_UNKNOWN")
    return typedAs(check, itemSchemaOf(spec, loopKey, context, parsed.path))
}

const workflowsProblem = (check: SiteCheck): RefProblem | null => {
    const { context, parsed } = check
    const { ref } = check.site
    if (context.workflows.size === 0) return ref.default === undefined ? sayOf(check, "REF_NOT_DOMINATOR") : null
    const graph = context.workflows.get(parsed.namespace ?? "")
    if (graph === undefined) return sayOf(check, "REF_WORKFLOW_UNKNOWN")
    const step = graph.get(parsed.nodeKey ?? "")
    if (step === undefined) return sayOf(check, "REF_NODE_UNKNOWN")
    if (ref.default === undefined) return sayOf(check, "REF_NOT_DOMINATOR")
    return typedAs(check, schemaPartAt(context.outcomes.get(step), parsed))
}

/**
 * The problem of a ref to the failure of a step: no graph draws a path a failure surely takes (a step that cannot complete goes to the
 * engine, never to a branch), so a failure is never surely there and the ref needs a default.
 */
const failurePathProblem = (check: SiteCheck): RefProblem | null =>
    check.parsed.part === "error" && check.site.ref.default === undefined ? sayOf(check, "REF_NOT_DOMINATOR") : null

const stepProblem = (check: SiteCheck): RefProblem | null => {
    const { spec, context, parsed, dominators } = check
    const { node, ref } = check.site
    const source = spec.nodes.find((candidate) => candidate.key === (parsed.nodeKey ?? ""))
    if (source === undefined) return sayOf(check, "REF_NODE_UNKNOWN")
    if (source.key === node.key || (reaches(spec, node.key, source.key) && !reaches(spec, source.key, node.key)))
        return sayOf(check, "REF_SELF")
    const outside = [...loopBodiesOf(spec).values()].some((body) => body.has(source.key) && !body.has(node.key))
    if (outside) return sayOf(check, "REF_LOOP_BODY")
    const dominated = dominators.get(node.key)?.has(source.key) === true
    if (!dominated && ref.default === undefined) return sayOf(check, "REF_NOT_DOMINATOR")
    return failurePathProblem(check) ?? typedAs(check, schemaPartAt(context.outcomes.get(source.step), parsed))
}

/** The problem of one ref site, or null when it is sound. */
const siteProblem = (
    spec: GraphSpec,
    site: Site,
    context: RefValidationContext,
    dominators: DominatorMap,
): RefProblem | null => {
    const parsed = parseRef(site.ref.$ref)
    if (parsed === null) return problemOf("REF_SYNTAX", site.node, site.field, site.ref.$ref)
    const check: SiteCheck = { spec, site, parsed, context, dominators }
    switch (parsed.root) {
        case "trigger":
            return triggerProblem(check)
        case "lead":
            return LEAD_FACT_SET.has(parsed.path[0] ?? "") ? null : sayOf(check, "REF_FIELD_UNKNOWN")
        case "out":
            return outProblem(check)
        case "item":
            return itemProblem(check)
        case "workflows":
            return workflowsProblem(check)
        case "steps":
            return stepProblem(check)
    }
}

/** The JSON Schema of an element of a for-each node's list (its `items` ref read as a step output), at a path; `UNTYPED` when untyped. */
const itemSchemaOf = (
    spec: GraphSpec,
    loopKey: string,
    context: RefValidationContext,
    path: ReadonlyArray<string>,
): Json => {
    const loop = spec.nodes.find((candidate) => candidate.key === loopKey)
    const items: unknown = loop?.params?.[LOOP_ITEMS_PARAM]
    const parsed = isParamRef(items) ? parseRef(items.$ref) : null
    if (parsed?.root !== "steps") return UNTYPED
    const source = spec.nodes.find((candidate) => candidate.key === parsed.nodeKey)
    const list = source === undefined ? UNTYPED : schemaPartAt(context.outcomes.get(source.step), parsed)
    if (list === UNTYPED || list === MISSING) return UNTYPED
    const [only] = branchesOf(list)
    const element = only?.["type"] === "array" && isRecord(only["items"]) ? only["items"] : null
    return element === null ? UNTYPED : schemaAt(element, path)
}

/** The JSON Schema of the part of an outcome a parsed ref reads, at its path. */
const schemaPartAt = (outcome: NodeOutcomeDeclaration | undefined, parsed: ParsedRef): Json => {
    if (outcome === undefined) return UNTYPED
    const root = parsed.part === "error" ? failureSchemaOf(outcome) : jsonSchemaOf(outcome.output, "output")
    return schemaAt(root, parsed.path)
}

/**
 * The refusals of a new workflow version for its params and refs: an unknown param, a fixed value its schema refuses, a malformed ref,
 * a ref to a node, a member, a workflow that is not there, a type the param cannot take, a ref to a node that may not have run before
 * (not a dominator) without a default, a ref to itself or to a later node. Each one is keyed for i18n (`workflowRef.*`).
 */
export const graphRefProblems = (spec: GraphSpec, context: RefValidationContext): ReadonlyArray<RefProblem> => {
    const dominators = dominatorsOf(spec)
    return spec.nodes.flatMap((node) => [
        ...outcomeProblems(node, context),
        ...paramProblems(node, context),
        ...sitesOf(node, context).flatMap((site) => siteProblem(spec, site, context, dominators) ?? []),
    ])
}
