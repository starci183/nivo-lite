import {
    isLoopUntil,
    isStoredPresence,
    type GraphNodeAccount,
    type GraphSpec,
    type GraphSpecNode,
    type GraphSpecV2,
    type GraphTagSource,
    type GraphV2NodeStep,
    type GraphV2Step,
    type StoredExpr,
    type StoredLeaf,
    type StoredRef,
    type WorkflowTrigger,
} from "@nivo-lite/agent-sdk/graph"
import type { Bilingual } from "@nivo-lite/agent-sdk/module"
import { PROVIDER, type CoreProviderConstant } from "@nivo-lite/agent-sdk/names"
import {
    LOOP_STEP,
    isParamRef,
    type NodeDefinition,
    type NodeRole,
    type ParamBinding,
    type ParamBindings,
    type ParamRef,
} from "@nivo-lite/agent-sdk/node"
import type { JsonValue, SpecText } from "@nivo-lite/agent-sdk/schema"
import type {
    AnyTemplateNode,
    TemplateAgent,
    TemplateGraph,
    WorkflowTemplate,
    WorkflowTemplateConnection,
} from "@nivo-lite/agent-sdk/template"
import { conditionsOfVerbSource, sourcesOfVerb, wakeOfSource } from "./template-triggers.policy"

/**
 * The step id the engine runs a @2 data condition (`ifNode`, kind `if`) under once the graph is read as the engine's graph: the engine
 * evaluates `params.when` itself with the SDK's `whenHolds` (the node host), so it can never be mistaken for blocks-core's `core.if`
 * (`op` / `compare`), which the old graphs keep using.
 */
export const TEMPLATE_IF_STEP = "core.when"

/**
 * The step id the engine runs a @2 `loop({ until })` under (`kind: "loop"`, `params.mode: "until"`) once the graph is read as the
 * engine's graph: the ENGINE drives its rounds itself (a cycle with its own round counter, `agent-threads/compiler-until.policy.ts`),
 * so it can never be mistaken for the list loop (`core.for-each` / `loop({ over })`), whose compile and run are another lane's.
 */
export const TEMPLATE_UNTIL_STEP = "core.until"

/**
 * The step id the engine runs a @2 `wait` under: the ENGINE parks the run on it (an interrupt with the triggers it listens for and a
 * stored deadline job) and resumes it with what came; it routes on its output's `trigger` (`WAIT_ROUTE_MEMBER`).
 */
export const TEMPLATE_WAIT_STEP = "core.wait"

/** The `kind` and `mode` of a @2 step that is a loop until a condition. */
const LOOP_KIND = "loop"
const UNTIL_MODE = "until"

/** The instant every template graph's one version is published at: the re-seed takes ONE current version, no history. */
const TEMPLATE_PUBLISHED_AT = "2026-11-12T00:00:00.000Z"

/** What the adapter reads of the installation besides the graph: the old control nodes (`core.call-workflow`, `core.outcome`, `core.for-each`). */
export interface GraphAdapterLookups {
    /** The `defineNode` node of an id, or undefined: a control step's role and its effects (the grant) are read from it. */
    readonly legacyNodeOf: (id: string) => NodeDefinition | undefined
    /** The template node of an id, or undefined: a node step's tools (the grant) are read from it. */
    readonly templateNodeOf: (id: string) => AnyTemplateNode | undefined
}

/** A core provider key, as the SDK declares it (`PROVIDER`). */
type CoreProvider = (typeof PROVIDER)[CoreProviderConstant]

/**
 * The host's kind of the accounts of each core provider (`GraphNodeAccount.kind`: `messaging`, `payment`, `mail`, `books`), the same
 * as the engine's provider catalogue gives it (`PROVIDER_CATALOGUE` of the gateway: a spec holds the two equal; this module may not
 * read the catalogue, which reads the installation). Total over the SDK's core keys: a provider added there without a kind does not
 * compile. `nivo` is NIVO's own pseudo-account (no connection): its kind is its own key. `google_drive` is served by the `google`
 * account (the catalogue holds the Drive reads under it), so it is of that kind.
 */
const KIND_OF_CORE_PROVIDER: Readonly<Record<CoreProvider, string>> = {
    nivo: "nivo",
    zalo_oa: "messaging",
    telegram: "messaging",
    meta: "messaging",
    sepay: "payment",
    casso: "payment",
    payos: "payment",
    smtp: "mail",
    imap: "mail",
    google: "books",
    google_drive: "books",
    inet: "domain",
    tino: "domain",
    elevenlabs: "media",
    veo: "media",
    tiktok: "media",
    misa_amis: "books",
    misa_meinvoice: "books",
    shotstack: "media",
    creatomate: "media",
    json2video: "media",
}

/** The kind of a source key's account (`crm`): the kind of the OpenAPI provider that serves every source (`records`). */
export const SOURCE_ACCOUNT_KIND = "records"

const KINDS: ReadonlyMap<string, string> = new Map(Object.entries(KIND_OF_CORE_PROVIDER))

/**
 * The kind of the accounts of a provider a template node lists: a core provider's (`KIND_OF_CORE_PROVIDER`), else (the only other key
 * a `@2` step may name, `providerKeySchema`) a source's, `SOURCE_ACCOUNT_KIND`.
 */
export const accountKindOf = (provider: string): string => KINDS.get(provider) ?? SOURCE_ACCOUNT_KIND

/**
 * A step's providers as the engine's `@1` member (`GraphNodeAccount`), the ONE road every reader of a node's providers takes: in the
 * step's order (the order is the priority, read back as `position`), each with its provider AS THE NODE NAMES IT (a source key stays
 * `crm`: the binding maps an attached account to that key, never the stored rows), its kind (`accountKindOf`) and no connection (bound
 * from the agent's attachments). No operations: the step's ONE mode is the node's own member (`GraphSpecNode.mode`). An empty list
 * stays empty: the node acts through NIVO's own tools only.
 */
const accountsOfStep = (step: GraphV2NodeStep): ReadonlyArray<GraphNodeAccount> =>
    step.accounts.map((provider) => ({ kind: accountKindOf(provider), provider, connectionId: null }))

/**
 * The words the map shows on a control step (R68: an `if`'s question, a wait, a loop, a hand-back, an outcome), carried as written; nothing
 * when the step has none (the card keeps its generic word). A node step has no label: its node's title names it.
 */
const labelOf = (step: { readonly label?: SpecText | undefined }): { readonly label?: SpecText } =>
    step.label === undefined ? {} : { label: step.label }

/** A step of @2 as a node of the engine's graph (`nivo/agent-graph@1`). */
const nodeOfStep = (step: GraphV2Step, lookups: GraphAdapterLookups): GraphSpecNode => {
    const roleOf = (fallback: NodeRole): NodeRole => lookups.legacyNodeOf(step.step)?.role ?? fallback
    switch (step.kind) {
        case "node":
            // A routing node routes on `output[routeBy]`: the thread compiler reads the member from the template node's `routes.by`.
            return {
                key: step.key,
                kind: step.routes === undefined ? "execute" : "condition",
                step: step.step,
                params: bindingsJsonOf(step.params),
                ...(step.model === undefined ? {} : { model: step.model }),
                ...(step.blocking === false ? { blocking: false } : {}),
                ...(step.next === undefined ? {} : { next: step.next }),
                ...(step.routes === undefined ? {} : { routes: step.routes }),
                // The step's ONE mode (the step's, else its node's: the @2 read writes it on every node step): always carried.
                mode: step.mode,
                accounts: accountsOfStep(step),
                // R68: what the ENGINE does when the step ends unsuccessfully (notice, then `continue` or `end` at an outcome), as written.
                ...(step.unsuccessful === undefined ? {} : { unsuccessful: step.unsuccessful }),
            }
        case "if":
            // A branch with no route (`no` of a compiled `callWorkflows`; either of `endItem` in a body) ends the run, or the item in a body.
            return {
                key: step.key,
                kind: "condition",
                step: TEMPLATE_IF_STEP,
                params: { when: conditionJsonOf(step.params.when) },
                routes: {
                    ...(step.routes.yes === undefined ? {} : { yes: step.routes.yes }),
                    ...(step.routes.no === undefined ? {} : { no: step.routes.no }),
                },
                ...labelOf(step),
            }
        case "call-workflow":
            return {
                key: step.key,
                kind: roleOf("output"),
                step: step.step,
                params: { agent: step.params.agent, workflow: step.params.workflow, version: step.params.version, inputs: bindingsJsonOf(step.params.inputs) },
                ...(step.next === undefined ? {} : { next: step.next }),
            }
        case "outcome":
            return {
                key: step.key,
                kind: roleOf("output"),
                step: step.step,
                params: { outcome: step.params.outcome, outputs: bindingsJsonOf(step.params.outputs) },
                ...(step.next === undefined ? {} : { next: step.next }),
                ...labelOf(step),
            }
        case "wait":
            // Routes on `output.trigger` (the key that came, or `timeout`); a match value's ref is read when the wait begins.
            return {
                key: step.key,
                kind: "condition",
                step: TEMPLATE_WAIT_STEP,
                params: {
                    on: step.params.on.map((on) => untilExprJsonOf(on)),
                    timeout: untilExprJsonOf(step.params.timeout),
                },
                routes: { ...step.routes },
                ...labelOf(step),
            }
        case "hand-back":
            // `core.hand-back`: offers the event its wait took (same round) on to the next waiter, then to the registrations.
            return {
                key: step.key,
                kind: roleOf("output"),
                step: step.step,
                params: { wait: step.params.wait },
                ...(step.next === undefined ? {} : { next: step.next }),
                ...labelOf(step),
            }
        case "loop":
        default:
            return loopNodeOf(step, lookups)
    }
}

/** A loop step of @2: `loop` (`core.loop`, `over` or `until`), or the stored `for-each` it replaces. */
type AnyLoopStep = Exclude<GraphV2Step, { readonly kind: "node" | "if" | "call-workflow" | "outcome" | "wait" | "hand-back" }>

/**
 * A loop step as the engine's loop node. `over` (and a stored `for-each`, which is an `over` of `concurrency` 1) runs on the registered
 * package node `core.for-each` (`LOOP_STEP`): the engine drives it, with `concurrency` carried as written (absent = 1, the sequential
 * cycle; above 1, the fan-out; the engine bounds it to 5). `until` is `untilNodeOfStep`'s.
 */
const loopNodeOf = (step: AnyLoopStep, lookups: GraphAdapterLookups): GraphSpecNode => {
    const until = untilNodeOfStep(step)
    // R68: an `until` loop that declares its notice carries it: the engine tells the team when it runs out of rounds; its label and the
    // words of its two ways out (`exits`) are carried for the map.
    if (until !== null) {
        if (step.kind !== LOOP_KIND || !isLoopUntil(step)) return until
        return {
            ...until,
            ...(step.unsuccessful === undefined ? {} : { unsuccessful: step.unsuccessful }),
            ...labelOf(step),
            ...(step.exits === undefined ? {} : { exits: step.exits }),
        }
    }
    const params = new Map<string, unknown>(Object.entries(step.params))
    const exit = step.next === undefined ? {} : { next: step.next }
    const text = (name: string): Readonly<Record<string, string>> => {
        const value = params.get(name)
        return typeof value === "string" ? { [name]: value } : {}
    }
    const concurrency = params.get("concurrency")
    const items = params.get("items")
    return {
        key: step.key,
        kind: lookups.legacyNodeOf(LOOP_STEP)?.role ?? "execute",
        step: LOOP_STEP,
        params: {
            ...(isStoredRefJson(items) ? { items: refJsonOf(items) } : {}),
            max: typeof params.get("max") === "number" ? Number(params.get("max")) : null,
            ...text("collect"),
            ...text("itemKey"),
            ...(typeof concurrency === "number" ? { concurrency } : {}),
        },
        routes: { ...step.routes },
        ...exit,
        ...(step.kind === LOOP_KIND ? labelOf(step) : {}),
    }
}

/** Whether a value is a stored ref (`{ $ref, default? }`). */
const isStoredRefJson = (value: unknown): value is StoredRef =>
    typeof value === "object" && value !== null && typeof Reflect.get(value, "$ref") === "string"

const isJsonRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * An expression of a `loop.until` as the JSON a node's params hold: every ref (`{ $ref }`) gains `default: null` when it has none, so
 * an absent value compares as null (what `ifNode` refs carry), and everything else is kept as written; the engine judges the rest.
 */
const untilExprJsonOf = (value: unknown): JsonValue => {
    if (isParamRef(value)) return refJsonOf(value.default === undefined ? { $ref: value.$ref, default: null } : value)
    if (Array.isArray(value)) return value.map((one: unknown) => untilExprJsonOf(one))
    if (!isJsonRecord(value)) return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null
    return Object.fromEntries(Object.entries(value).map(([name, member]) => [name, untilExprJsonOf(member)]))
}

/**
 * A @2 `loop({ until })` step as the engine's node `TEMPLATE_UNTIL_STEP`, or null for every other step (the list loop and the rest
 * stay `nodeOfStep`'s): `params` keeps `mode`, the condition (`until`: an expression, its refs defaulted to null, or the meaning form
 * `{ route, stop }` as written), `max` and `every` as written (the engine's save check and compiler refuse a bad one, never this
 * adapter); `routes` keeps `body` and `exhausted`; `next` follows the loop when the condition holds. Read from the step as data, so a
 * raw `@2` document the SDK's types do not know yet is read the same way.
 */
const untilNodeOfStep = (step: unknown): GraphSpecNode | null => {
    if (!isJsonRecord(step) || step.kind !== LOOP_KIND || typeof step.key !== "string") return null
    const params = isJsonRecord(step.params) ? step.params : {}
    if (params.mode !== UNTIL_MODE) return null
    const routes = isJsonRecord(step.routes) ? step.routes : {}
    return {
        key: step.key,
        kind: "execute",
        step: TEMPLATE_UNTIL_STEP,
        params: {
            mode: UNTIL_MODE,
            until: untilExprJsonOf(params.until ?? null),
            max: untilExprJsonOf(params.max ?? null),
            ...(params.every === undefined ? {} : { every: untilExprJsonOf(params.every) }),
        },
        routes: Object.fromEntries(
            Object.entries(routes).flatMap(([name, target]) => (typeof target === "string" ? [[name, target]] : [])),
        ),
        ...(typeof step.next === "string" ? { next: step.next } : {}),
    }
}

/** A stored ref as plain JSON, with every option it carries (`default`, `round`): an option dropped here never reaches `resolveRef`. */
const refJsonOf = (ref: StoredRef | ParamRef): JsonValue => ({
    $ref: ref.$ref,
    ...(ref.default === undefined ? {} : { default: ref.default }),
    ...(ref.round === undefined ? {} : { round: ref.round }),
})

/** One binding (a fixed value, or a ref) as plain JSON. */
const bindingJsonOf = (binding: ParamBinding): JsonValue => (isParamRef(binding) ? refJsonOf(binding) : binding)

/** Bindings as the plain JSON a node's params hold. */
const bindingsJsonOf = (bindings: ParamBindings): Readonly<Record<string, JsonValue>> =>
    Object.fromEntries(Object.entries(bindings).map(([name, binding]) => [name, bindingJsonOf(binding)]))

/** One stored leaf as plain JSON. */
const leafJsonOf = (leaf: StoredLeaf): JsonValue => {
    if (isStoredPresence(leaf)) return { ref: refJsonOf(leaf.ref), op: leaf.op }
    return {
        ref: refJsonOf(leaf.ref),
        op: leaf.op,
        value: isParamRef(leaf.value) ? refJsonOf(leaf.value) : leaf.value,
        ...(leaf.op === "contains" && leaf.caseFold === true ? { caseFold: true } : {}),
    }
}

/** A stored expression (`and` / `or` / `not` over leaves) as the JSON a node's params hold; the engine's evaluator reads it back. */
const conditionJsonOf = (when: StoredExpr): JsonValue => {
    if ("and" in when) return { and: when.and.map((part) => conditionJsonOf(part)) }
    if ("or" in when) return { or: when.or.map((part) => conditionJsonOf(part)) }
    if ("not" in when) return { not: conditionJsonOf(when.not) }
    return leafJsonOf(when)
}

/** The key suffix of the n-th source of one trigger: none for the first, `-<n>` after it. */
const suffixOf = (at: number): string => (at === 0 ? "" : `-${at + 1}`)

/**
 * The triggers of today a @2 graph's verbs listen on: each @2 trigger is the adapters of the providers it lists (or the engine road),
 * one registration per source of each (SePay and Casso: SePay's two roads then Casso's provider trigger, keyed `t<n>`, `t<n>-2`, `t<n>-3`;
 * one run by the credit's record key); each carries the conditions that keep the verb's own events on its source
 * (`conditionsOfVerbSource`: the money in of a bank feed's movements) and the graph's `where`, as written. A registration names no
 * connection: the workspace's accounts bind to it at run time, one source per stream (owner key `triggerOneSource2026_11_12`, CORRECTED).
 */
const triggersOf = (spec: GraphSpecV2): ReadonlyArray<WorkflowTrigger> =>
    spec.triggers.flatMap((entry, index) =>
        sourcesOfVerb(entry.verb, entry.accounts).map((source, at): WorkflowTrigger => {
            const conditions = conditionsOfVerbSource(entry.verb, source, entry.where)
            return {
                key: `t${index + 1}${suffixOf(at)}`,
                source,
                ...(conditions.length === 0 ? {} : { conditions: [...conditions] }),
            }
        }),
    )

/**
 * The grant the engine still judges a run by, DERIVED (never written in @2): the tools of every template node the graph places (each
 * call of a template node is a tool call), the effects of the old control nodes it runs through (the hand-off's tag).
 */
const grantOf = (spec: GraphSpecV2, lookups: GraphAdapterLookups): GraphSpec["grant"] => {
    const tools = new Set<string>()
    const effects = new Set<string>()
    for (const step of spec.nodes) {
        if (step.kind === "node") {
            for (const tool of lookups.templateNodeOf(step.step)?.tools ?? []) tools.add(tool)
            continue
        }
        // A wait calls nothing: the engine parks and resumes the run; a hand-back calls nothing: the engine offers the event on.
        if (step.kind === "wait" || step.kind === "hand-back") continue
        const legacy = lookups.legacyNodeOf(step.kind === "if" || step.kind === "call-workflow" || step.kind === "outcome" ? step.step : LOOP_STEP)
        for (const effect of legacy?.effects ?? []) effects.add(effect)
        for (const tool of legacy?.tools ?? []) tools.add(tool)
    }
    return { tools: [...tools].sort(), effects: [...effects].sort() }
}

/** The order the @1 envelope lists its tag sources in (the order the SDK's retired `wakesOfTriggers` used). */
const WAKE_ORDER: ReadonlyArray<GraphTagSource> = ["channel", "chats-group", "agent", "system-event", "schedule"]

/**
 * The tag sources of the @1 envelope a set of triggers wakes on, once each, in envelope order: the engine's road of each source
 * (`wakeOfSource`, the trigger registry's). The SDK no longer knows a road per kind (one event pipeline, triggers rule 13); routing of the
 * wakes that are not on the pipeline yet still reads this envelope.
 */
const wakesOfTriggers = (triggers: ReadonlyArray<WorkflowTrigger>): ReadonlyArray<GraphTagSource> => {
    const wakes = new Set(triggers.map((trigger) => wakeOfSource(trigger.source)))
    return WAKE_ORDER.filter((wake) => wakes.has(wake))
}

/**
 * A @2 graph (`nivo/agent-graph@2`) as the engine's graph (`@1`), the ONE adapter the engine reads @2 by while both forms run in one
 * install: the steps stay flat and keep their keys; a template node step keeps its params (input and settings bound by member; the host
 * splits them by the node's two schemas), its model, `blocking: false` and its routes (the role is `condition` for a routing node, else
 * `execute`); an `if` becomes `TEMPLATE_IF_STEP` with `params.when`; the control steps keep their `core.*` ids and params. The old
 * envelope is DERIVED: the triggers of today each verb listens on (`sourcesOfVerb`), their wakes, and the grant (settle: the trigger declaration's). A node step's
 * `accounts` are CARRIED as the `@1` member (`accountsOfStep`), so the publish gate, readiness, the money floor and every row writer read
 * a template node's accounts where they read every node's.
 */
export const graphOfSpecV2 = (spec: GraphSpecV2, lookups: GraphAdapterLookups): GraphSpec => {
    const triggers = triggersOf(spec)
    return {
        schema: "nivo/agent-graph@1",
        moduleKey: spec.moduleKey,
        contract: spec.contract,
        triggers,
        outcomes: spec.outcomes,
        entry: spec.entry,
        trigger: { kind: "tag", sources: wakesOfTriggers(triggers) },
        grant: grantOf(spec, lookups),
        nodes: spec.nodes.map((step) => nodeOfStep(step, lookups)),
    }
}

/** The words of a graph's title in both languages: its own, the catalog's of its key, or the key itself. */
const bilingualOf = (title: SpecText, fallback: string, messages: (key: string) => Bilingual | null): Bilingual => {
    if ("vi" in title) return { vi: title.vi, en: title.en }
    return messages(title.key) ?? { vi: fallback, en: fallback }
}

/** The words a list of titles joins with, in both languages. */
const TITLE_JOIN = ", "

/**
 * What a template needs connected, DERIVED from its node steps' accounts (contract ADDENDUM 2, 1.: never typed): one entry per distinct
 * provider a node step lists, sorted by key, NIVO's own pseudo-account (`nivo`, always bound) aside, a source key kept as nodes name it
 * (`crm`). `kind` is the provider key (what the market's catalogue and the connections read); `label` is that key in both languages
 * (this module reads no provider catalogue); `why` names the steps that ask for it, by their template node's title (else the step key).
 */
const requiresOf = (
    spec: GraphSpecV2,
    lookups: GraphAdapterLookups & { readonly messages: (key: string) => Bilingual | null },
): ReadonlyArray<WorkflowTemplateConnection> => {
    const askers = new Map<string, Array<Bilingual>>()
    for (const step of spec.nodes) {
        if (step.kind !== "node") continue
        const title = lookups.templateNodeOf(step.step)?.title
        const named = title === undefined ? { vi: step.key, en: step.key } : bilingualOf(title, step.key, lookups.messages)
        for (const provider of new Set(step.accounts)) {
            if (provider === PROVIDER.nivo) continue
            askers.set(provider, [...(askers.get(provider) ?? []), named])
        }
    }
    const joined = (titles: ReadonlyArray<Bilingual>, locale: keyof Bilingual): string =>
        [...new Set(titles.map((title) => title[locale]))].join(TITLE_JOIN)
    return [...askers.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([provider, titles]) => ({
            kind: provider,
            label: { vi: provider, en: provider },
            why: { vi: joined(titles, "vi"), en: joined(titles, "en") },
        }))
}

/**
 * One graph of a template agent as a workflow template of the agent's module, so the engine's install road (seed, adoption, the agent's
 * page) takes it as it takes every template: id = the graph's key, primary when it is the agent's `primary`, ONE version holding the graph
 * read as the engine's graph.
 */
export const workflowTemplateOfGraph = (
    agent: TemplateAgent,
    graph: TemplateGraph,
    lookups: GraphAdapterLookups & { readonly messages: (key: string) => Bilingual | null },
): WorkflowTemplate => {
    const name = bilingualOf(graph.spec.title, graph.key, lookups.messages)
    return {
        id: graph.key,
        moduleKey: graph.spec.moduleKey,
        primary: graph.key === agent.primary,
        // The graph's own word on being installed ACTIVE (its catalogue's `seedActive`): the install road (`seedAgent`) reads it as it
        // reads a legacy template's flag; absent, a graph that is not the primary is installed as a draft.
        ...(graph.spec.catalogue?.seedActive === true ? { seedActive: true } : {}),
        name,
        summary: name,
        requires: requiresOf(graph.spec, lookups),
        shops: 0,
        versions: [{ version: 1, publishedAt: TEMPLATE_PUBLISHED_AT, changes: [name], graph: graphOfSpecV2(graph.spec, lookups) }],
    }
}
