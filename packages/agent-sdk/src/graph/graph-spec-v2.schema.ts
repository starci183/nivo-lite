import { z } from "zod"
import type { ParamBinding } from "../node/memory.contracts"
import { PROVIDER, type ProviderKey, type ToolId, type TriggerVerb } from "../names"
import { keyText, prose } from "../schema/bounded.schema"
import { entriesAtMost } from "../schema/entries"
import { jsonValue } from "../schema/json-value.schema"
import { isNamespaced, isToolId, isTriggerVerb } from "../schema/namespaced"
import type { JsonSchema, JsonValue, Namespaced, SpecText } from "../schema/schema.types"
import type {
    GraphCatalogue,
    GraphSpecV2,
    GraphV2HandBackStep,
    GraphV2LoopOverStep,
    GraphV2LoopUntilStep,
    GraphV2WaitOn,
    GraphV2WaitStep,
    GraphV2NodeStep,
    GraphV2Step,
    GraphV2Trigger,
    LoopEvery,
    LoopUnsuccessfulSpec,
    NoticeFactSpec,
    StepUnsuccessfulSpec,
    LoopUntilRoute,
    Mode,
    ModelChoice,
    StoredExpr,
    StoredLeaf,
    StoredRef,
} from "./graph-spec-v2.types"
import {
    CALL_WORKFLOW_STEP_V2,
    FOR_EACH_STEP,
    HAND_BACK_STEP,
    IF_STEP,
    LOOP_STEP_V2,
    OUTCOME_STEP_V2,
    WAIT_STEP,
} from "./graph-spec-v2"
import {
    triggerConditionSchema,
    workflowContractSchema,
    workflowEntrySchema,
    workflowOutcomesSchema,
} from "./workflow-contract"

/*
 * The ONE documented schema boundary of @2: the JSON names a tool, a trigger, a provider and a model by string, and the types name them by
 * their declared unions. The schema checks the LAW of each name (`nivo.tool.*`, `nivo.trigger.*`, a provider key's form, a model's form);
 * whether a name is DECLARED is the engine's registry check at save (`TOOL_UNKNOWN`, `TRIGGER_UNKNOWN`, `TemplateToolLookup`), because a
 * source's names are declared only in the engine's build. So the refinements below narrow by a type guard that trusts the law.
 */

const stepKey = keyText.regex(/^[a-z][a-z0-9-]*$/)

/** A provider key by its form. */
const isProviderForm = (value: string): value is ProviderKey => /^[a-z][a-z0-9_]{1,30}$/.test(value)

/** A model id by its form. */
const isModelForm = (value: string): value is ModelChoice => /^[a-z0-9][a-z0-9./:-]{0,79}$/.test(value)

const toolId: z.ZodType<ToolId> = keyText.refine((value): value is ToolId => isToolId(value), {
    message: "not a nivo.tool.* id",
})
const triggerVerb: z.ZodType<TriggerVerb> = keyText.refine((value): value is TriggerVerb => isTriggerVerb(value), {
    message: "not a nivo.trigger.* verb",
})
const providerKey: z.ZodType<ProviderKey> = keyText.refine(isProviderForm, { message: "not a provider key" })
const modelChoice: z.ZodType<ModelChoice> = keyText.refine(isModelForm, { message: "not a model id" })
const nodeId: z.ZodType<Namespaced> = keyText.refine((value): value is Namespaced => isNamespaced(value), {
    message: "not a node id",
})

const specTextSchema: z.ZodType<SpecText> = z.union([
    z.strictObject({ key: keyText.min(1) }),
    z.strictObject({ vi: prose, en: prose }),
])

const storedRef: z.ZodType<StoredRef> = z.strictObject({ $ref: keyText.min(1), default: jsonValue.optional(), round: z.literal("previous").optional() })

/** A binding: a ref, or a JSON value (whose objects may hold refs at any depth: a ref is JSON). */
const binding: z.ZodType<ParamBinding> = z.union([storedRef, jsonValue])
const bindings = z.record(keyText, binding).refine(entriesAtMost(200))

const valueOrRef: z.ZodType<JsonValue | StoredRef> = z.union([storedRef, jsonValue])

/** The notice facts of an unsuccessful ending (R68): how many a step may declare is judged at save (`GRAPH_UNSUCCESSFUL_FACTS_TOO_MANY`). */
const noticeFacts: z.ZodType<ReadonlyArray<NoticeFactSpec>> = z
    .array(z.strictObject({ label: specTextSchema, value: binding }))
    .max(20)

/** A step's unsuccessful ending as stored: `then` always written; the outcome and its place are judged at save. */
const stepUnsuccessful: z.ZodType<StepUnsuccessfulSpec> = z.strictObject({
    then: z.enum(["continue", "end"]),
    outcome: stepKey.optional(),
    facts: noticeFacts,
})

/** An `until` loop's unsuccessful ending as stored: the facts of the notice when it runs out of rounds. */
const loopUnsuccessful: z.ZodType<LoopUnsuccessfulSpec> = z.strictObject({ facts: noticeFacts })

const leaf: z.ZodType<StoredLeaf> = z.union([
    z.strictObject({ op: z.enum(["eq", "ne", "lt", "lte", "gt", "gte"]), ref: storedRef, value: valueOrRef }),
    z.strictObject({ op: z.literal("contains"), ref: storedRef, value: valueOrRef, caseFold: z.literal(true).optional() }),
    z.strictObject({ op: z.enum(["present", "absent"]), ref: storedRef }),
])

/** The most parts one `and` / `or` lists, structurally; the save bounds (`EXPR_TOO_DEEP`, `EXPR_TOO_LARGE`) are `exprProblems`'. */
const PARTS_MAX = 16

/**
 * An expression as the schema reads it. `legacy` also reads the old one-level `all` / `any` (stored drafts, NODES-LEAD's graphs before
 * the flip) and gives them back as `and` / `or`: what is read is always the current form.
 */
const exprSchemaOf = (legacy: boolean): z.ZodType<StoredExpr> => {
    const self: z.ZodType<StoredExpr> = z.lazy(() => {
        const parts = z.tuple([self], self).refine((list) => list.length <= PARTS_MAX, { message: "at most 16 parts" })
        const current = [
            leaf,
            z.strictObject({ and: parts }),
            z.strictObject({ or: parts }),
            z.strictObject({ not: self }),
        ] as const
        if (!legacy) return z.union(current)
        return z.union([
            ...current,
            z.strictObject({ all: parts }).transform((group): StoredExpr => ({ and: group.all })),
            z.strictObject({ any: parts }).transform((group): StoredExpr => ({ or: group.any })),
        ])
    })
    return self
}

const mode: z.ZodType<Mode> = z.enum(["auto", "ask"])

const base = { key: stepKey, loop: stepKey.optional() }

/** What a node step holds beside its rights, in both forms. */
const nodeStepBase = {
    ...base,
    kind: z.literal("node"),
    step: nodeId,
    params: bindings,
    model: modelChoice.optional(),
    blocking: z.literal(false).optional(),
    next: stepKey.optional(),
    routeBy: keyText.min(1).optional(),
    routes: z.record(keyText, stepKey).refine(entriesAtMost(50)).optional(),
    unsuccessful: stepUnsuccessful.optional(),
}

/** A node step as written: ONE mode and the providers in priority order (`nivo-frame.rights`). */
const nodeStep: z.ZodType<GraphV2NodeStep> = z.strictObject({
    ...nodeStepBase,
    mode,
    accounts: z.array(providerKey).max(20),
})

/** One account of this lane's older stored step: a provider and a mode per tool. Read only, never written. */
const legacyAccount = z.strictObject({
    provider: providerKey,
    operations: z.record(toolId, mode).refine(entriesAtMost(100)),
})

/**
 * This lane's older stored node step (`accounts: [{ provider, operations }]`, no `mode`), read as the current one: the providers in
 * order with NIVO's own pseudo-provider `nivo` dropped (never listed now), and `mode` `ask` when ANY operation of the step asked, else
 * `auto`. A step mixing the two forms is neither, so it is refused.
 */
const legacyNodeStep: z.ZodType<GraphV2NodeStep> = z
    .strictObject({ ...nodeStepBase, accounts: z.array(legacyAccount).max(20) })
    .transform(({ accounts, ...rest }): GraphV2NodeStep => ({
        ...rest,
        mode: accounts.some((account) => Object.values(account.operations).includes("ask")) ? "ask" : "auto",
        accounts: accounts.map((account) => account.provider).filter((provider) => provider !== PROVIDER.nivo),
    }))

const every: z.ZodType<LoopEvery> = z.union([
    z.strictObject({ minutes: z.number().int() }),
    z.strictObject({ hours: z.number().int() }),
    z.strictObject({ days: z.number().int() }),
])

const untilRoute: z.ZodType<LoopUntilRoute> = z.strictObject({ route: stepKey, stop: keyText.min(1) })

/** The bounds of `max`, `concurrency` and `every` are judged by `templateGraphProblems` (`LOOP_*_INVALID`), never here. */
const loopOverStep: z.ZodType<GraphV2LoopOverStep> = z.strictObject({
    ...base,
    kind: z.literal("loop"),
    step: z.literal(LOOP_STEP_V2),
    params: z.strictObject({
        mode: z.literal("over"),
        items: storedRef,
        itemKey: keyText.min(1).optional(),
        max: z.number().int(),
        collect: stepKey.optional(),
        concurrency: z.number().int(),
    }),
    routes: z.strictObject({ body: stepKey }),
    next: stepKey.optional(),
    label: specTextSchema.optional(),
})

/** The old loop of stored drafts, read as a `loop` / `over`: `concurrency` 1, sequential, as it ran. */
const legacyForEachStep: z.ZodType<GraphV2LoopOverStep> = z
    .strictObject({
        ...base,
        kind: z.literal("for-each"),
        step: z.literal(FOR_EACH_STEP),
        params: z.strictObject({
            items: storedRef,
            max: z.number().int(),
            collect: stepKey,
            itemKey: keyText.min(1).optional(),
        }),
        routes: z.strictObject({ body: stepKey }),
        next: stepKey.optional(),
    })
    .transform(
        (old): GraphV2LoopOverStep => ({
            kind: "loop",
            key: old.key,
            ...(old.loop === undefined ? {} : { loop: old.loop }),
            step: LOOP_STEP_V2,
            params: {
                mode: "over",
                items: old.params.items,
                ...(old.params.itemKey === undefined ? {} : { itemKey: old.params.itemKey }),
                max: old.params.max,
                collect: old.params.collect,
                concurrency: 1,
            },
            routes: { body: old.routes.body },
            ...(old.next === undefined ? {} : { next: old.next }),
        }),
    )

const callWorkflowStep = z.strictObject({
    ...base,
    kind: z.literal("call-workflow"),
    step: z.literal(CALL_WORKFLOW_STEP_V2),
    params: z.strictObject({
        agent: keyText.regex(/^[a-z][a-z0-9_]{1,23}$/),
        workflow: keyText.regex(/^[a-z][a-z0-9-]{0,63}$/),
        version: z.union([z.number().int().positive(), z.literal("latest")]),
        inputs: bindings,
    }),
    next: stepKey.optional(),
})

const outcomeStep = z.strictObject({
    ...base,
    kind: z.literal("outcome"),
    step: z.literal(OUTCOME_STEP_V2),
    params: z.strictObject({ outcome: stepKey, outputs: bindings }),
    next: stepKey.optional(),
    label: specTextSchema.optional(),
})

/** One trigger of a wait as stored. */
const waitOn: z.ZodType<GraphV2WaitOn> = z.strictObject({
    key: keyText.min(1),
    verb: triggerVerb,
    where: z.array(triggerConditionSchema).max(20).optional(),
    match: z
        .array(
            z.strictObject({
                member: keyText.min(1),
                op: z.enum(["eq", "contains"]),
                value: valueOrRef,
                caseFold: z.literal(true).optional(),
            }),
        )
        .max(8)
        .optional(),
})

/** A wait: the bounds (count, keys, routes, timeout) are judged by `templateGraphProblems` (`WAIT_*`), never here. */
const waitStep: z.ZodType<GraphV2WaitStep> = z.strictObject({
    ...base,
    kind: z.literal("wait"),
    step: z.literal(WAIT_STEP),
    params: z.strictObject({
        on: z.tuple([waitOn], waitOn).refine((list) => list.length <= 20, { message: "at most 20 triggers" }),
        timeout: every,
    }),
    routes: z.record(keyText, stepKey).refine(entriesAtMost(21)),
    label: specTextSchema.optional(),
})

/** A hand-back: where it may sit (a trigger route of its wait) is judged by `templateGraphProblems` (`GRAPH_HAND_BACK_NO_EVENT`). */
const handBackStep: z.ZodType<GraphV2HandBackStep> = z.strictObject({
    ...base,
    kind: z.literal("hand-back"),
    step: z.literal(HAND_BACK_STEP),
    params: z.strictObject({ wait: stepKey }),
    next: stepKey.optional(),
    label: specTextSchema.optional(),
})

/** The members every form of a trigger shares. */
const triggerBase = {
    verb: triggerVerb,
    args: z.record(keyText, jsonValue).refine(entriesAtMost(50)).optional(),
    where: z.array(triggerConditionSchema).max(20).optional(),
}

/** The providers of a trigger as written: at least one, each once. */
const triggerAccounts = z
    .array(providerKey)
    .min(1)
    .max(20)
    .refine((list) => new Set(list).size === list.length, { message: "a trigger names each provider once" })

/**
 * A trigger as written: the verb and the providers whose accounts carry it (owner key `triggerOneSource2026_11_12`, CORRECTED: one
 * trigger per purpose, one source per underlying stream, bound by the engine in the workspace).
 */
const triggerSchema: z.ZodType<GraphV2Trigger> = z.strictObject({ ...triggerBase, accounts: triggerAccounts.optional() })

/**
 * A stored trigger in any form that exists, read as the current one: the list before one source (`providers: [...]`), the one-account
 * form (`account: x`, read as `accounts: [x]`) and `accounts` itself; a trigger naming its providers in two forms is refused, and an
 * empty list is no provider.
 */
const legacyTriggerSchema: z.ZodType<GraphV2Trigger> = z
    .strictObject({
        ...triggerBase,
        accounts: z.array(providerKey).max(20).optional(),
        account: providerKey.optional(),
        providers: z.array(providerKey).max(20).optional(),
    })
    .refine((entry) => [entry.accounts, entry.account, entry.providers].filter((one) => one !== undefined).length <= 1, {
        message: "a trigger names its accounts once",
        path: ["accounts"],
    })
    .transform(({ providers, account, accounts, ...rest }): GraphV2Trigger => {
        const listed = accounts ?? providers ?? (account === undefined ? [] : [account])
        return listed.length === 0 ? rest : { ...rest, accounts: listed }
    })

const isoInstant = keyText.refine((value) => /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value)), {
    message: "not an ISO 8601 instant",
})

const catalogueSchema: z.ZodType<GraphCatalogue> = z.strictObject({
    name: specTextSchema,
    summary: specTextSchema,
    version: z.number().int().positive(),
    publishedAt: isoInstant,
    notes: specTextSchema,
    seedActive: z.boolean().optional(),
})

/** The steps and the document, with the expression schema given; `legacy` also reads the old `for-each` step and trigger forms. */
const documentSchemaOf = (legacy: boolean): z.ZodType<GraphSpecV2> => {
    const expr = exprSchemaOf(legacy)
    const ifStep = z.strictObject({
        ...base,
        kind: z.literal("if"),
        step: z.literal(IF_STEP),
        params: z.strictObject({ when: expr }),
        routes: z.strictObject({ yes: stepKey.optional(), no: stepKey.optional() }),
        label: specTextSchema.optional(),
    })
    const loopUntilStep: z.ZodType<GraphV2LoopUntilStep> = z.strictObject({
        ...base,
        kind: z.literal("loop"),
        step: z.literal(LOOP_STEP_V2),
        params: z.strictObject({
            mode: z.literal("until"),
            until: z.union([untilRoute, expr]),
            max: z.number().int(),
            every: every.optional(),
        }),
        routes: z.strictObject({ body: stepKey, exhausted: stepKey }),
        unsuccessful: loopUnsuccessful.optional(),
        next: stepKey,
        label: specTextSchema.optional(),
        exits: z.strictObject({ until: specTextSchema.optional(), exhausted: specTextSchema.optional() }).optional(),
    })
    const current = [nodeStep, ifStep, loopOverStep, loopUntilStep, callWorkflowStep, outcomeStep, waitStep, handBackStep] as const
    const step: z.ZodType<GraphV2Step> = legacy
        ? z.union([...current, legacyNodeStep, legacyForEachStep])
        : z.union(current)
    const trigger: z.ZodType<GraphV2Trigger> = legacy ? legacyTriggerSchema : triggerSchema
    return z.strictObject({
        schema: z.literal("nivo/agent-graph@2"),
        key: keyText.regex(/^[a-z][a-z0-9_]{1,23}\.[a-z][a-z0-9-]{0,63}$/),
        moduleKey: keyText.regex(/^[a-z][a-z0-9_]{1,23}$/),
        title: specTextSchema,
        contract: workflowContractSchema,
        triggers: z
            .tuple([trigger], trigger)
            .refine((list) => list.length <= 10, { message: "at most 10 triggers" }),
        entry: workflowEntrySchema,
        outcomes: workflowOutcomesSchema,
        catalogue: catalogueSchema.optional(),
        nodes: z.tuple([step], step).refine((list) => list.length <= 200, { message: "at most 200 steps" }),
    })
}

/**
 * The structure of a @2 graph as READ: what it means is judged by `templateGraphProblems` (`@nivo-lite/agent-sdk/template`). It also
 * reads the old forms of stored drafts and gives back the current one: a node step's per-tool modes as one `mode` and its providers
 * (`legacyNodeStep`), a `for-each` step as a `loop` / `over` (`concurrency` 1), an
 * `all` / `any` condition as `and` / `or`, a trigger's `providers` list or one `account` as its `accounts`. What it gives is always the
 * form `defineTemplateGraph` writes.
 */
export const graphSpecV2Schema: z.ZodType<GraphSpecV2> = documentSchemaOf(true)

/**
 * The structure of a @2 graph as WRITTEN: the current form only (a node step's one `mode` and its providers; no per-tool modes, no
 * `for-each`, no `all` / `any`, no `providers` / `account`).
 */
export const graphSpecV2WrittenSchema: z.ZodType<GraphSpecV2> = documentSchemaOf(false)

/** The JSON Schema of a @2 graph as written (`graphSpecV2WrittenSchema`), for a seed step that validates files by JSON Schema. */
export const graphSpecV2JsonDocument: JsonSchema = z.toJSONSchema(
    graphSpecV2WrittenSchema.meta({ title: "NIVO agent graph spec @2" }),
    {
        target: "draft-2020-12",
        unrepresentable: "any",
    },
)
