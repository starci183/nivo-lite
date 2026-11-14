import { createHash } from "node:crypto"
import { z } from "../../schema/zod-entry"
import { typeOfSchema } from "../../graph/graph-ref-schema"
import type {
    GraphCatalogue,
    GraphSpecV2,
    GraphV2Step,
    GraphV2Trigger,
    GraphV2WaitOn,
    GraphV2WaitStep,
    LoopEvery,
    LoopUntil,
    StoredExpr,
    StoredLeaf,
    StoredRef,
} from "../../graph/graph-spec-v2.types"
import { TRIGGER_DATA_MEMBER, type ContractType, type OutcomeOutput, type WorkflowInput, type WorkflowOutcome } from "../../graph/workflow-contract"
import { TRIGGER } from "../../names"
import { isParamRef } from "../../node/memory"
import type { ParamBinding, ParamBindings } from "../../node/memory.contracts"
import type { JsonValue } from "../../schema/schema.types"
import { canonicalJson } from "../canonical"
import type {
    CompiledGraph,
    GraphStep,
    LeafCondition,
    ListedCall,
    LoopGraphStep,
    NodeGraphStep,
    RefOrValue,
    TemplateCatalogue,
    TemplateGraph,
    TemplateGraphConfig,
    TemplateTrigger,
    UnboundedExpr,
    UntilCondition,
    UntilRoute,
    WaitGraphStep,
    WaitTimeout,
    WaitTrigger,
} from "./graph-builder.types"
import { HAND_BACK_STEP, WAIT_STEP } from "../../graph/graph-spec-v2"
import { trusted } from "../../schema/trusted"
import { endItem, isPresenceCondition } from "./graph-builder"
import { refSchemaIn, templateGraphProblems } from "./graph-problems"
import type { AnyTemplateNode } from "./template-example"
import { type TemplateProblem, refuseProblems } from "./template-problems"

/** A ref or value as stored: a ref keeps only `$ref`, its `default` and its `round` (a ref to the round before, R13). */
const storedOf = (value: RefOrValue): ParamBinding => {
    if (isParamRef(value))
        return {
            $ref: value.$ref,
            ...(value.default === undefined ? {} : { default: value.default }),
            ...(value.round === undefined ? {} : { round: value.round }),
        }
    return value
}

/** Bindings as stored. */
const bindingsOf = (record: Readonly<Record<string, RefOrValue>>): ParamBindings =>
    Object.fromEntries(Object.entries(record).map(([name, value]) => [name, storedOf(value)]))

/** A condition ref as stored: an absent value compares as null. */
const conditionRef = (value: RefOrValue): StoredRef | JsonValue => {
    if (!isParamRef(value)) return value
    return { $ref: value.$ref, default: value.default ?? null }
}

/** A ref as a condition writes it: its path and an optional default. */
interface WrittenRef {
    /** The path the ref reads (`trigger.<member>`, `steps.<key>.output...`, `item...`). */
    readonly $ref: string
    /** What the ref reads when its source holds nothing; absent: null. */
    readonly default?: JsonValue | undefined
}

/** A condition ref that must be a ref. */
const leafRef = (value: WrittenRef): StoredRef => ({
    $ref: value.$ref,
    default: value.default ?? null,
})

const storedLeaf = (leaf: LeafCondition): StoredLeaf =>
    isPresenceCondition(leaf)
        ? { ref: leafRef(leaf.ref), op: leaf.op }
        : {
              ref: leafRef(leaf.ref),
              op: leaf.op,
              value: conditionRef(leaf.value),
              ...(leaf.op === "contains" && leaf.caseFold === true ? { caseFold: true } : {}),
          }

/** The parts of a group as stored, the tuple kept. */
const storedParts = (parts: readonly [UnboundedExpr, ...Array<UnboundedExpr>]): readonly [StoredExpr, ...Array<StoredExpr>] => {
    const [first, ...rest] = parts
    return [storedExprOf(first), ...rest.map((part) => storedExprOf(part))]
}

/** An expression as stored, every ref with a null default when it has none. */
export const storedExprOf = (expr: UnboundedExpr): StoredExpr => {
    if (expr.and !== undefined) return { and: storedParts(expr.and) }
    if (expr.or !== undefined) return { or: storedParts(expr.or) }
    if (expr.not !== undefined) return { not: storedExprOf(expr.not) }
    return storedLeaf(expr)
}

/** Whether an `until` stops on a route of a body node. */
const isUntilRoute = (until: UntilCondition): until is UntilRoute => "route" in until && typeof until.route === "string"

/** An `until` as stored. */
const storedUntilOf = (until: UntilCondition): LoopUntil =>
    isUntilRoute(until) ? { route: until.route, stop: until.stop } : storedExprOf(until)

/** The check of one call of a `callWorkflows`: its list present, or its expression. */
const callCheckOf = (call: ListedCall): StoredExpr =>
    isParamRef(call.when) ? { op: "present", ref: leafRef(call.when) } : storedExprOf(call.when)

/** A loop step as stored, its body steps after it. */
const loopStepsOf = (key: string, step: LoopGraphStep, loop: string | null): ReadonlyArray<GraphV2Step> => {
    const inLoop = loop === null ? {} : { loop }
    const head: GraphV2Step =
        step.mode === "over"
            ? {
                  kind: "loop",
                  key,
                  ...inLoop,
                  step: "core.loop",
                  params: {
                      mode: "over",
                      items:
                          step.over.default === undefined
                              ? { $ref: step.over.$ref }
                              : { $ref: step.over.$ref, default: step.over.default },
                      ...(step.itemKey === null ? {} : { itemKey: step.itemKey }),
                      max: step.max,
                      ...(step.body.collect === null ? {} : { collect: step.body.collect }),
                      concurrency: step.concurrency,
                  },
                  routes: { body: step.body.start },
                  ...nextOf(step.next),
              }
            : {
                  kind: "loop",
                  key,
                  ...inLoop,
                  step: "core.loop",
                  params: {
                      mode: "until",
                      until: storedUntilOf(step.until),
                      max: step.max,
                      ...(step.every === null ? {} : { every: { ...step.every } }),
                  },
                  routes: { body: step.body.start, exhausted: step.exhausted },
                  next: step.next,
              }
    return [
        head,
        ...orderedEntries(step.body.start, step.body.nodes).flatMap(([bodyKey, bodyStep]) =>
            stepsOf(bodyKey, bodyStep, key),
        ),
    ]
}
/** A target as stored: `endItem` is left out (the engine's loop reads a missing `next`, branch or route as the end of the item). */
const keptTarget = (target: string | null): string | null => (target === null || target === endItem ? null : target)

/** Routes as stored: those naming `endItem` left out. */
const keptRoutes = (routes: Readonly<Record<string, string>>): Readonly<Record<string, string>> =>
    Object.fromEntries(Object.entries(routes).filter(([, target]) => target !== endItem))

/** The `next` member of a stored step, when it has one. */
interface NextMember {
    /** The step after it; absent when there is none. */
    readonly next?: string
}

/** The `next` member as stored: absent for none or for `endItem`. */
const nextOf = (target: string | null): NextMember => {
    const kept = keptTarget(target)
    return kept === null ? {} : { next: kept }
}

/** A template node step as stored. */
const nodeStepOf = (key: string, step: NodeGraphStep, loop: string | null): GraphV2Step => {
    const node = step.node
    const routes = node.routes
    return {
        kind: "node",
        key,
        ...(loop === null ? {} : { loop }),
        step: node.id,
        params: { ...bindingsOf(step.input), ...bindingsOf(step.params) },
        ...(node.model === undefined ? {} : { model: node.model }),
        mode: step.mode ?? node.mode,
        accounts: [...(step.accounts ?? node.accounts)],
        ...(node.blocking === false ? { blocking: false } : {}),
        ...(routes === undefined ? nextOf(step.next) : { routeBy: routes.by, routes: keptRoutes(step.routes ?? {}) }),
    }
}

/** The key of the i-th check of a `callWorkflows` (the first is the step's own key, so a `next` to it lands on it). */
const callCheckKey = (key: string, index: number): string => (index === 0 ? key : `${key}-when-${index + 1}`)

/** The steps a builder step compiles to, its body steps after a loop. */
const stepsOf = (key: string, step: GraphStep, loop: string | null): ReadonlyArray<GraphV2Step> => {
    const inLoop = loop === null ? {} : { loop }
    switch (step.kind) {
        case "node":
            return [nodeStepOf(key, step, loop)]
        case "if": {
            const yes = keptTarget(step.yes)
            const no = keptTarget(step.no)
            return [
                {
                    kind: "if",
                    key,
                    ...inLoop,
                    step: "core.if",
                    params: { when: storedExprOf(step.when) },
                    routes: { ...(yes === null ? {} : { yes }), ...(no === null ? {} : { no }) },
                },
            ]
        }
        case "loop":
            return loopStepsOf(key, step, loop)
        case "call-workflow":
            return [
                {
                    kind: "call-workflow",
                    key,
                    ...inLoop,
                    step: "core.call-workflow",
                    params: {
                        agent: step.agent,
                        workflow: step.workflow,
                        version: step.version,
                        inputs: bindingsOf(step.input),
                    },
                    ...nextOf(step.next),
                },
            ]
        case "call-workflows":
            return step.calls.flatMap((call, index): ReadonlyArray<GraphV2Step> => {
                const after = index + 1 < step.calls.length ? callCheckKey(key, index + 1) : keptTarget(step.next)
                const callKey = `${key}-call-${index + 1}`
                return [
                    {
                        kind: "if",
                        key: callCheckKey(key, index),
                        ...inLoop,
                        step: "core.if",
                        params: { when: callCheckOf(call) },
                        routes: after === null ? { yes: callKey } : { yes: callKey, no: after },
                    },
                    {
                        kind: "call-workflow",
                        key: callKey,
                        ...inLoop,
                        step: "core.call-workflow",
                        params: {
                            agent: call.agent,
                            workflow: call.workflow,
                            version: call.version ?? "latest",
                            inputs: bindingsOf(call.input),
                        },
                        ...(after === null ? {} : { next: after }),
                    },
                ]
            })
        case "outcome":
            return [
                {
                    kind: "outcome",
                    key,
                    ...inLoop,
                    step: "core.outcome",
                    params: { outcome: step.name, outputs: bindingsOf(step.output) },
                    ...nextOf(step.next),
                },
            ]
        case "wait":
            return [waitStepOf(key, step, loop)]
        case "hand-back":
            return [{ kind: "hand-back", key, ...inLoop, step: HAND_BACK_STEP, params: { wait: step.wait }, ...nextOf(step.next) }]
    }
}

/** A wait's timeout as stored: one unit of `LoopEvery` (a `"<n>m|h|d"` text read as that unit; its bounds are the save's). */
export const waitTimeoutOf = (timeout: WaitTimeout): LoopEvery => {
    if (typeof timeout !== "string") return timeout
    const count = Number(timeout.slice(0, -1))
    const unit = timeout.slice(-1)
    if (unit === "h") return { hours: count }
    if (unit === "d") return { days: count }
    return { minutes: count }
}

/** One trigger of a wait as stored: its key, verb, `where` and match (each match value a stored binding). */
const waitOnOf = (key: string, on: WaitTrigger): GraphV2WaitOn => ({
    key,
    verb: on.verb,
    ...(on.where === undefined ? {} : { where: on.where }),
    ...(on.match === undefined
        ? {}
        : {
              match: on.match.map((test) => ({
                  member: test.member,
                  op: test.op,
                  value: conditionRef(test.value),
                  ...(test.op === "contains" && test.caseFold === true ? { caseFold: true as const } : {}),
              })),
          }),
})

/** A wait as stored: `core.wait`, its triggers in written order, its timeout as one unit, one route per key and `timeout`. */
const waitStepOf = (key: string, step: WaitGraphStep, loop: string | null): GraphV2WaitStep => {
    const [first, ...rest] = Object.entries(step.on).map(([name, on]) => waitOnOf(name, on))
    // An empty `for` writes an empty list the save refuses (`WAIT_TRIGGERS_EMPTY`): the tuple type is kept for the document's shape.
    const on: GraphV2WaitStep["params"]["on"] = first === undefined ? trusted<GraphV2WaitStep["params"]["on"]>([]) : [first, ...rest]
    return {
        kind: "wait",
        key,
        ...(loop === null ? {} : { loop }),
        step: WAIT_STEP,
        params: { on, timeout: waitTimeoutOf(step.timeout) },
        // A route naming `endRound` is left out: in an `until` body that route ends the round (the engine's round end).
        routes: keptRoutes(
            Object.fromEntries(Object.entries(step.next).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
        ),
    }
}

/** The entries of a keyed branch, its start first, the rest in written order. */
const orderedEntries = (
    start: string,
    nodes: Readonly<Record<string, GraphStep>>,
): ReadonlyArray<readonly [string, GraphStep]> => {
    const entries = Object.entries(nodes)
    return [...entries.filter(([key]) => key === start), ...entries.filter(([key]) => key !== start)]
}

/** The contract type of a JSON type, or null when it is none. */
const contractTypeOf = (type: string): ContractType | null =>
    type === "string" ||
    type === "number" ||
    type === "integer" ||
    type === "boolean" ||
    type === "object" ||
    type === "array"
        ? type
        : null

/** The inputs a graph declares with the problems found reading its input schema. */
interface GraphContract {
    /** The inputs a run needs, each with its type and whether it is required. */
    readonly inputs: ReadonlyArray<WorkflowInput>
    /** What is wrong with the input schema. */
    readonly problems: ReadonlyArray<TemplateProblem>
}

/** The members of an object schema, each typed (null: no contract type) and whether a value must hold it. */
const typedMembersOf = (
    input: z.ZodObject,
): ReadonlyArray<{ readonly name: string; readonly type: ContractType | null; readonly required: boolean; readonly field: z.ZodType }> =>
    Object.entries(input.shape)
        .flatMap(([name, field]) => (field instanceof z.ZodType ? [[name, field] as const] : []))
        .map(([name, field]) => ({
            name,
            type: contractTypeOf(typeOfSchema(z.toJSONSchema(field, { io: "input", unrepresentable: "any" }))),
            required: !field.safeParse(undefined).success && !field.safeParse(null).success,
            field,
        }))

/** The object schema inside a field (through optional / nullable / default wrappers), or null when it holds none. */
const objectInside = (field: z.ZodType): z.ZodObject | null => {
    if (field instanceof z.ZodObject) return field
    if (field instanceof z.ZodOptional || field instanceof z.ZodNullable || field instanceof z.ZodDefault)
        return objectInside(field.unwrap() as z.ZodType)
    return null
}

/**
 * The inputs of a graph from its input schema: each member's type and whether a run needs it. A graph a `workflow.called` trigger wakes
 * (`called`) also states the members of its `data` input: the params a caller maps (lane concept triggers rule 13), one level.
 */
const contractOf = (key: string, input: z.ZodType, called: boolean): GraphContract => {
    if (!(input instanceof z.ZodObject))
        return { inputs: [], problems: [{ code: "NODE_SCHEMA_NOT_OBJECT", at: `${key}.input` }] }
    const typed = typedMembersOf(input)
    const membersOf = (name: string, field: z.ZodType): ReadonlyArray<WorkflowInput> | null => {
        const inner = called && name === TRIGGER_DATA_MEMBER ? objectInside(field) : null
        return inner === null
            ? null
            : typedMembersOf(inner).flatMap((member) =>
                  member.type === null ? [] : [{ name: member.name, type: member.type, required: member.required }],
              )
    }
    return {
        inputs: typed.flatMap((entry): ReadonlyArray<WorkflowInput> => {
            if (entry.type === null) return []
            const members = membersOf(entry.name, entry.field)
            return [{ name: entry.name, type: entry.type, required: entry.required, ...(members === null ? {} : { members }) }]
        }),
        problems: typed
            .filter((entry) => entry.type === null)
            .map((entry): TemplateProblem => ({ code: "GRAPH_INPUT_UNTYPED", at: `${key}.input.${entry.name}` })),
    }
}

/** The catalogue entry as stored. */
const catalogueOf = (catalogue: TemplateCatalogue): GraphCatalogue => ({
    name: catalogue.name,
    summary: catalogue.summary,
    version: catalogue.version,
    publishedAt: catalogue.publishedAt,
    notes: catalogue.notes,
    ...(catalogue.seedActive === undefined ? {} : { seedActive: catalogue.seedActive }),
})

/** A trigger as stored. */
const triggerOf = (entry: TemplateTrigger): GraphV2Trigger => ({ ...entry })

/** The type of an outcome output: of its fixed value, or of the schema its ref reads. */
const outputTypeOf = (
    binding: ParamBinding,
    step: GraphV2Step,
    spec: GraphSpecV2,
    nodes: ReadonlyMap<string, AnyTemplateNode>,
): ContractType | null => {
    if (isParamRef(binding)) return contractTypeOf(typeOfSchema(refSchemaIn(binding, step, spec, { nodes })))
    if (Array.isArray(binding)) return "array"
    if (binding === null) return null
    if (typeof binding === "number") return Number.isInteger(binding) ? "integer" : "number"
    if (typeof binding === "string") return "string"
    return typeof binding === "boolean" ? "boolean" : "object"
}

/**
 * The grammar of an outcome key, as the stored document reads it (`workflowOutcomesSchema`'s key in `graph/workflow-contract.ts`): a
 * name outside it compiles and loads, then makes the saved version unreadable, so the compile refuses it at definition.
 */
const OUTCOME_KEY = /^[a-z][a-z0-9-]{0,63}$/

/** The outcomes of a graph with the problems found typing them. */
interface OutcomesOfGraph {
    /** The outcomes declared by the outcome steps, in step order. */
    readonly outcomes: ReadonlyArray<WorkflowOutcome>
    /** What is wrong with an outcome's name or an output that cannot be typed. */
    readonly problems: ReadonlyArray<TemplateProblem>
}

/** The outcomes the outcome steps declare, typed from their outputs (the first step of a name types it). */
const outcomesOf = (draft: GraphSpecV2, nodes: ReadonlyMap<string, AnyTemplateNode>): OutcomesOfGraph => {
    const outcomes = new Map<string, WorkflowOutcome>()
    const problems: Array<TemplateProblem> = []
    for (const step of draft.nodes) {
        if (step.kind === "outcome" && !OUTCOME_KEY.test(step.params.outcome))
            problems.push({ code: "GRAPH_OUTCOME_NAME_INVALID", at: `nodes.${step.key}` })
        if (step.kind !== "outcome" || outcomes.has(step.params.outcome)) continue
        const outputs = Object.entries(step.params.outputs).flatMap(([name, binding]): ReadonlyArray<OutcomeOutput> => {
            const type = outputTypeOf(binding, step, draft, nodes)
            if (type === null)
                problems.push({ code: "GRAPH_OUTCOME_UNTYPED", at: `nodes.${step.key}.params.outputs.${name}` })
            return type === null ? [] : [{ name, type }]
        })
        outcomes.set(step.params.outcome, { key: step.params.outcome, label: step.params.outcome, outputs })
    }
    return { outcomes: [...outcomes.values()], problems }
}

/** The targets a builder step names, each with the member it is named at. */
const targetsOf = (step: GraphStep): ReadonlyArray<readonly [string, string]> => {
    switch (step.kind) {
        case "node":
            return [
                ...(step.next === null ? [] : [["next", step.next] as const]),
                ...Object.entries(step.routes ?? {}).map(([name, target]) => [`routes.${name}`, target] as const),
            ]
        case "if":
            return [["routes.yes", step.yes], ...(step.no === null ? [] : [["routes.no", step.no] as const])]
        case "loop":
            if (step.mode !== "over")
                return [
                    ["next", step.next],
                    ["routes.exhausted", step.exhausted],
                ]
            return step.next === null ? [] : [["next", step.next]]
        case "call-workflow":
        case "call-workflows":
        case "outcome":
        case "hand-back":
            return step.next === null ? [] : [["next", step.next]]
        case "wait":
            return Object.entries(step.next).map(([name, target]) => [`routes.${name}`, target] as const)
    }
}

/** The route names of a routing node step that name no target. */
const untargetedRoutesOf = (step: NodeGraphStep): ReadonlyArray<string> =>
    (step.node.routes?.names ?? []).flatMap((name: string) => {
        const target: unknown = step.routes === null ? undefined : Reflect.get(step.routes, name)
        return typeof target === "string" && target !== "" ? [] : [`routes.${name}`]
    })

/**
 * What only the builder input can tell, since the compile leaves `endItem` out of the document: `endItem` named outside a loop body
 * (`GRAPH_END_ITEM_OUTSIDE`), and, inside a body, a branch of an `ifNode` or a route of a routing node that names an empty key
 * (`GRAPH_ROUTE_UNTARGETED`). An `ifNode` with no `no` is legal anywhere: the item ends in a body, the run outside one.
 */
const builderProblems = (
    nodes: Readonly<Record<string, GraphStep>>,
    loop: string | null,
): ReadonlyArray<TemplateProblem> =>
    Object.entries(nodes).flatMap(([key, step]): ReadonlyArray<TemplateProblem> => {
        const at = `nodes.${key}`
        const outside =
            loop === null
                ? targetsOf(step)
                      .filter(([, target]) => target === endItem)
                      .map(([member]): TemplateProblem => ({ code: "GRAPH_END_ITEM_OUTSIDE", at: `${at}.${member}` }))
                : []
        // An `until` given from untyped code without its mandatory ends (tsc refuses it in typed code).
        const untilEnds: ReadonlyArray<TemplateProblem> =
            step.kind === "loop" && step.mode === "until"
                ? [
                      ...(typeof step.exhausted === "string" && step.exhausted !== ""
                          ? []
                          : [{ code: "LOOP_EXHAUSTED_MISSING" as const, at: `${at}.exhausted` }]),
                      ...(typeof step.next === "string" && step.next !== ""
                          ? []
                          : [{ code: "LOOP_NEXT_MISSING" as const, at: `${at}.next` }]),
                  ]
                : []
        let untargeted: ReadonlyArray<string> = []
        if (loop !== null && step.kind === "if")
            untargeted = targetsOf(step).flatMap(([member, target]) => (target === "" ? [member] : []))
        if (loop !== null && step.kind === "node") untargeted = untargetedRoutesOf(step)
        return [
            ...outside,
            ...untilEnds,
            ...untargeted.map((member): TemplateProblem => ({ code: "GRAPH_ROUTE_UNTARGETED", at: `${at}.${member}` })),
            ...(step.kind === "loop" ? builderProblems(step.body.nodes, key) : []),
        ]
    })

/** The template nodes a graph places, by id. */
const nodesOf = (steps: Readonly<Record<string, GraphStep>>): ReadonlyArray<AnyTemplateNode> =>
    Object.values(steps).flatMap((step): ReadonlyArray<AnyTemplateNode> => {
        if (step.kind === "node") return [step.node]
        return step.kind === "loop" ? nodesOf(step.body.nodes) : []
    })

/** The problem of a value that is not data. */
const notData = (at: string): ReadonlyArray<TemplateProblem> => [{ code: "GRAPH_VALUE_NOT_DATA", at }]

/**
 * The values inside a graph's config that are not data, by a structural walk: a function, a symbol, a bigint, a class instance (an
 * object whose prototype is not `Object.prototype` or null), a symbol-keyed member, an `undefined` (or a hole) inside a list. An
 * `undefined` member of an object is an absent member, never a problem.
 */
const notDataIn = (value: unknown, at: string, inList: boolean): ReadonlyArray<TemplateProblem> => {
    if (value === undefined) return inList ? notData(at) : []
    if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return []
    if (typeof value !== "object") return notData(at)
    if (Array.isArray(value)) {
        const list: ReadonlyArray<unknown> = value
        return Array.from({ length: list.length }, (_, index) => index).flatMap((index) =>
            notDataIn(list[index], `${at}.${index}`, true),
        )
    }
    const prototype: unknown = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return notData(at)
    if (Object.getOwnPropertySymbols(value).length > 0) return notData(at)
    return Object.entries(value).flatMap(([name, member]) => notDataIn(member, `${at}.${name}`, false))
}

/**
 * The values of one step that are not data. Two members are references, never wiring, and are not walked: the template node a `node`
 * step places (compiled to its id) and, at the graph's head, the `input` schema (compiled to the contract). A loop's body steps are
 * walked as steps.
 */
const notDataInStep = (step: GraphStep, at: string): ReadonlyArray<TemplateProblem> =>
    Object.entries(step).flatMap(([name, member]): ReadonlyArray<TemplateProblem> => {
        if (step.kind === "node" && name === "node") return []
        if (step.kind === "loop" && name === "body") {
            const body: LoopGraphStep["body"] = step.body
            return Object.entries(body).flatMap(([part, inner]): ReadonlyArray<TemplateProblem> =>
                part === "nodes"
                    ? Object.entries(body.nodes).flatMap(([key, bodyStep]) =>
                          notDataInStep(bodyStep, `${at}.body.nodes.${key}`),
                      )
                    : notDataIn(inner, `${at}.body.${part}`, false),
            )
        }
        return notDataIn(member, `${at}.${name}`, false)
    })

/** The values of a graph's config that are not data (`GRAPH_VALUE_NOT_DATA`); see `notDataIn`. */
const notDataProblemsOf = (config: TemplateGraphConfig): ReadonlyArray<TemplateProblem> =>
    Object.entries(config).flatMap(([name, member]): ReadonlyArray<TemplateProblem> => {
        if (name === "input") return []
        if (name === "nodes")
            return Object.entries(config.nodes).flatMap(([key, step]) => notDataInStep(step, `nodes.${key}`))
        return notDataIn(member, name, false)
    })

/** How strictly a compile judges: `nullability` as `TemplateGraphContext.nullability` (lenient when absent). */

export interface CompileOptions {
    /** `strict` judges a ref that may read nothing against its site; `lenient` compares the JSON types only. */
    readonly nullability?: "strict" | "lenient" | undefined
}

/**
 * Compiles a template graph to GraphSpec `nivo/agent-graph@2` with every problem decidable WITHOUT the engine
 * (`templateGraphProblems` with no lookup; the agent's providers are judged by `defineTemplateAgent`). Pure: it throws nothing.
 */
export const compileTemplateGraph = (config: TemplateGraphConfig, options: CompileOptions = {}): CompiledGraph => {
    const moduleKey = config.key.split(".", 1).join("")
    const contract = contractOf(
        config.key,
        config.input,
        config.triggers.some((entry) => entry.verb === TRIGGER.workflowCalled),
    )
    // A value that is not data is refused before anything reads it: the compile never throws on a function where data belongs.
    const notData = notDataProblemsOf(config)
    if (notData.length > 0) {
        return {
            graph: {
                entry: "template-graph",
                key: config.key,
                spec: emptySpec(config, moduleKey, contract.inputs),
                nodes: new Map(nodesOf(config.nodes).map((node) => [node.id, node])),
            },
            problems: notData,
        }
    }
    const flat = orderedEntries(config.start, config.nodes).flatMap(([key, step]) => stepsOf(key, step, null))
    const [first, ...rest] = flat
    const placed = nodesOf(config.nodes)
    const nodes = new Map(placed.map((node) => [node.id, node]))
    const keyProblems: ReadonlyArray<TemplateProblem> = [
        ...builderProblems(config.nodes, null),
        ...(/^[a-z][a-z0-9_]{1,23}\.[a-z][a-z0-9-]{0,63}$/.test(config.key)
            ? []
            : [{ code: "GRAPH_KEY_MALFORMED" as const, at: config.key }]),
        ...(config.start in config.nodes ? [] : [{ code: "GRAPH_START_UNKNOWN" as const, at: `${config.key}.start` }]),
    ]
    if (first === undefined) {
        return {
            graph: {
                entry: "template-graph",
                key: config.key,
                spec: emptySpec(config, moduleKey, contract.inputs),
                nodes,
            },
            problems: [
                ...keyProblems,
                ...contract.problems,
                { code: "GRAPH_START_UNKNOWN", at: `${config.key}.nodes` },
            ],
        }
    }
    const draft: GraphSpecV2 = {
        schema: "nivo/agent-graph@2",
        key: config.key,
        moduleKey,
        title: config.title,
        contract: { inputs: contract.inputs },
        triggers: [triggerOf(config.triggers[0]), ...config.triggers.slice(1).map((entry) => triggerOf(entry))],
        entry: {
            openTo: config.openTo ?? "any",
        },
        outcomes: [],
        ...(config.catalogue === undefined ? {} : { catalogue: catalogueOf(config.catalogue) }),
        nodes: [first, ...rest],
    }
    const outcomes = outcomesOf(draft, nodes)
    const spec: GraphSpecV2 = { ...draft, outcomes: outcomes.outcomes }
    return {
        graph: { entry: "template-graph", key: config.key, spec, nodes },
        problems: [
            ...keyProblems,
            ...contract.problems,
            ...outcomes.problems,
            ...templateGraphProblems(spec, {
                nodes,
                ...(options.nullability === undefined ? {} : { nullability: options.nullability }),
            }),
        ],
    }
}

/** The document of a graph with no step: only ever returned beside its problem. */
const emptySpec = (
    config: TemplateGraphConfig,
    moduleKey: string,
    inputs: ReadonlyArray<WorkflowInput>,
): GraphSpecV2 => ({
    schema: "nivo/agent-graph@2",
    key: config.key,
    moduleKey,
    title: config.title,
    contract: { inputs },
    triggers: [triggerOf(config.triggers[0]), ...config.triggers.slice(1).map((entry) => triggerOf(entry))],
    entry: { openTo: config.openTo ?? "any" },
    outcomes: [],
    nodes: [{ kind: "outcome", key: "end", step: "core.outcome", params: { outcome: "end", outputs: {} } }],
})

/**
 * Defines a template graph: compiles it (`compileTemplateGraph`) with STRICT ref nullability (a ref that may read nothing needs a
 * non-null `default`, or a site that accepts null / is optional) and throws `TemplateDefinitionError` at module load with every problem.
 * The problems that need the engine (unknown tools and verbs, provider ownership, money tools, what a verb supplies) are judged at save.
 */
export const defineTemplateGraph = (config: TemplateGraphConfig): TemplateGraph => {
    const compiled = compileTemplateGraph(config, { nullability: "strict" })
    refuseProblems(config.key, compiled.problems)
    return compiled.graph
}

/** The canonical text of a @2 document: object keys sorted, absent members left out. What a hash and a seed file are made of. */
export const templateGraphText = (spec: GraphSpecV2): string => canonicalJson(spec)

/** The sha-256 of a @2 document's canonical text. */
export const templateGraphHashV2 = (spec: GraphSpecV2): string =>
    createHash("sha256").update(templateGraphText(spec)).digest("hex")
