import { z } from "../../schema/zod-entry"
import { DomainError, isDomainError } from "@starci/common"
import { canonicalJson } from "../canonical"
import { trusted } from "../../schema/trusted"
import { DEFAULT_AI_READ_TOOLS, DEFAULT_NODE_TOOLS, type ToolId } from "../../names"
import type { JsonObject, JsonValue } from "../../schema/schema.types"
import type {
    FailReason,
    NodeContext,
    NodeExample,
    ScriptedAgentTurn,
    ScriptedToolCall,
    TemplateAgentRequest,
    ToolAnswer,
    WorkspaceFacts,
    DeclinedAnswer,
    TemplateNodeTools,
    AnyTemplateNode,
} from "./template-node.types"
import { NO_PARAMS, templateNodeProblems, toolAnswerRead } from "./template-node"
import { NodeFailedError, isNodeFailed } from "./template-problems"

/** The instant every example runs at unless it names its own. */
export const EXAMPLE_RUN_AT = "2026-01-05T09:00:00.000+07:00"

/**
 * The day of an example that names none: the date its instant is written with, so `2026-01-05T09:00:00.000+07:00` (the shop's own
 * offset) is `2026-01-05`. An example that needs another day (an instant written in UTC late in the shop's evening) names `day`.
 */
export const exampleDayOf = (at: string): string => at.slice(0, 10)

/** The workspace every example runs in unless it names its own (`ctx.workspace`): the default zone, a name, no logo. */
export const EXAMPLE_WORKSPACE: WorkspaceFacts = { timeZone: "Asia/Ho_Chi_Minh", name: "C\u1eeda h\u00e0ng m\u1eabu" }

/** The run id every example runs under. */
export const EXAMPLE_RUN_ID = "run-1"

export type { AnyTemplateNode } from "./template-node.types"

/** Any example of any node. */
type AnyExample = NodeExample<z.ZodType, z.ZodType, z.ZodType>

/** What stops an example at the first thing it did not promise; never escapes `templateExampleMismatches`. */
class ExampleBroken extends DomainError<"EXAMPLE_BROKEN"> {
    /** What the example did not promise. */
    readonly what: string

    constructor(what: string) {
        super({ code: "EXAMPLE_BROKEN", params: { at: what } })
        this.what = what
    }
}

/** One call the run made: its id and whether it answered ok. */
interface MadeCall {
    readonly id: ToolId
    readonly ok: boolean
}

/** The scripted ports of one example: they consume the script in order and record every call. */
interface ScriptedPorts {
    readonly context: NodeContext
    readonly made: ReadonlyArray<MadeCall>
    readonly left: () => ReadonlyArray<string>
}

/** The text of a value for a mismatch line, short. */
const shown = (value: unknown): string => canonicalJson(value).slice(0, 300)

/** The ports an example runs over: the tools and agent scripts, and the example's run, subject and policy. */
const scriptedPorts = (node: AnyTemplateNode, example: AnyExample, params: unknown): ScriptedPorts => {
    const at = example.at ?? EXAMPLE_RUN_AT
    const declared = new Set<string>([...node.tools, ...DEFAULT_NODE_TOOLS])
    // What an AI step of the node may ever call: its tools and every default (the read-context tools too).
    const aiHeld = new Set<string>([...declared, ...DEFAULT_AI_READ_TOOLS])
    const tools: ReadonlyArray<ScriptedToolCall> = example.tools ?? []
    const turns: ReadonlyArray<ScriptedAgentTurn> = example.agent ?? []
    const made: Array<MadeCall> = []
    let nextTool = 0
    let nextTurn = 0
    const declaredOrBroken = (id: string, where: string): void => {
        if (!declared.has(id)) throw new ExampleBroken(`${where}: ${id} is not in the node's tools`)
    }
    const call = (id: ToolId, args: JsonObject): Promise<ToolAnswer<JsonObject> | DeclinedAnswer> => {
        declaredOrBroken(id, `tool call ${nextTool}`)
        const scripted = tools[nextTool]
        if (scripted === undefined) throw new ExampleBroken(`tool call ${nextTool}: unexpected ${id}`)
        if (scripted.id !== id) throw new ExampleBroken(`tool call ${nextTool}: expected ${scripted.id}, called ${id}`)
        if (scripted.args !== undefined && canonicalJson(scripted.args) !== canonicalJson(args)) {
            throw new ExampleBroken(
                `tool call ${nextTool} (${id}): args ${shown(args)}, expected ${shown(scripted.args)}`,
            )
        }
        nextTool += 1
        made.push({ id, ok: scripted.answer.ok })
        // A scripted `declined` (the engine's code) is read as the node reads it: `ToolDeclined`.
        return Promise.resolve(toolAnswerRead(scripted.answer))
    }
    const run = <S extends z.ZodType>(request: TemplateAgentRequest<S>): Promise<z.output<S>> => {
        if (node.model === undefined)
            throw new ExampleBroken(`agent run ${nextTurn}: NODE_MODEL_MISSING (the node names no model)`)
        // The subset narrows the node's own tools; every default (the read-context tools, the record and file tools) is offered always.
        const offered = new Set<string>([
            ...(request.tools ?? node.tools),
            ...DEFAULT_AI_READ_TOOLS,
            ...DEFAULT_NODE_TOOLS,
        ])
        const undeclared = (request.tools ?? []).find((id) => !declared.has(id))
        if (undeclared !== undefined)
            throw new ExampleBroken(`agent run ${nextTurn}: ${undeclared} is not in the node's tools`)
        const turn = turns[nextTurn]
        if (turn === undefined) throw new ExampleBroken(`agent run ${nextTurn}: unexpected`)
        const index = nextTurn
        nextTurn += 1
        for (const inner of turn.calls ?? []) {
            if (!aiHeld.has(inner.id))
                throw new ExampleBroken(`agent run ${index}: ${inner.id} is not in the node's tools`)
            if (!offered.has(inner.id))
                throw new ExampleBroken(`agent run ${index}: ${inner.id} is not in the run's tools`)
            made.push({ id: inner.id, ok: inner.answer.ok })
        }
        if ("fail" in turn) throw new NodeFailedError(turn.fail)
        const parsed = request.output.safeParse(turn.answer)
        if (!parsed.success)
            throw new ExampleBroken(`agent run ${index}: answer does not fit the request's output schema`)
        return Promise.resolve(parsed.data)
    }
    const context: NodeContext = {
        params,
        run: {
            id: EXAMPLE_RUN_ID,
            at,
            day: example.day ?? exampleDayOf(at),
            item: example.item ?? null,
            queue: example.queue ?? [],
            waiting: example.waiting ?? 0,
        },
        subject: example.subject ?? null,
        workspace: example.workspace ?? EXAMPLE_WORKSPACE,
        // A scripted answer is the example author's: `declined` is scripted for a tool that can ask, as the engine answers it.
        tools: { call: trusted<TemplateNodeTools["call"]>(call) },
        agent: { run },
        policy: example.policy ?? {},
        fail: (reason: FailReason, facts?: JsonObject): never => {
            throw new NodeFailedError(reason, facts)
        },
    }
    const left = (): ReadonlyArray<string> => [
        ...(nextTool < tools.length ? [`${tools.length - nextTool} scripted tool answer(s) left unused`] : []),
        ...(nextTurn < turns.length ? [`${turns.length - nextTurn} scripted agent turn(s) left unused`] : []),
    ]
    return { context, made, left }
}

/** The `requires` entries no ok call met. */
const unmet = (node: AnyTemplateNode, made: ReadonlyArray<MadeCall>): ReadonlyArray<string> =>
    (node.requires ?? [])
        .filter((tool) => !made.some((call) => call.id === tool && call.ok))
        .map((tool) => `requires ${tool}: no ok call`)

/** What differs between the output the node gave and the one the example promised, the route included. */
const outputMismatches = (node: AnyTemplateNode, example: AnyExample, given: unknown): ReadonlyArray<string> => {
    if (example.failure !== undefined) return [`expected failure ${shown(example.failure)}, gave ${shown(given)}`]
    const parsed = node.output.safeParse(given)
    if (!parsed.success) return [`output does not fit the output schema: ${shown(given)}`]
    const routes = node.routes
    const route: unknown =
        routes !== undefined && typeof parsed.data === "object" && parsed.data !== null
            ? Reflect.get(parsed.data, routes.by)
            : undefined
    const routeNames: ReadonlyArray<string> = routes?.names ?? []
    return [
        ...(canonicalJson(parsed.data) === canonicalJson(example.output)
            ? []
            : [`output ${shown(parsed.data)}, expected ${shown(example.output)}`]),
        ...(routes === undefined || (typeof route === "string" && routeNames.includes(route))
            ? []
            : [`route ${shown(route)} is not a declared name`]),
    ]
}

/** What differs between the failure the node ended in and the example's. */
const failureMismatches = (example: AnyExample, reason: FailReason): ReadonlyArray<string> => {
    if (example.failure === undefined) return [`failed ${shown(reason)}, expected output`]
    return canonicalJson(example.failure) === canonicalJson(reason)
        ? []
        : [`failed ${shown(reason)}, expected ${shown(example.failure)}`]
}

/**
 * Runs one example of a template node with NO engine: `run` against the scripted tool answers (in call order, args asserted when given;
 * an unexpected, out-of-order or undeclared call fails) and the scripted agent turns (each answer parsed by the request's schema; a `fail`
 * turn ends the node as a confused model does); then its output (parsed, compared, its route a declared name) or its failure, every
 * `requires` met by an ok call, and no script left unused. Empty means the example holds.
 */
export const templateExampleMismatches = async (
    node: AnyTemplateNode,
    example: AnyExample,
): Promise<ReadonlyArray<string>> => {
    const params = (node.params ?? NO_PARAMS).safeParse(example.params)
    if (!params.success) return ["params do not fit the params schema"]
    const input = node.input.safeParse(example.input)
    if (!input.success) return ["input does not fit the input schema"]
    const ports = scriptedPorts(node, example, params.data)
    try {
        const given = await node.run(input.data, ports.context)
        return [...outputMismatches(node, example, given), ...unmet(node, ports.made), ...ports.left()]
    } catch (cause) {
        if (cause instanceof ExampleBroken) return [cause.what]
        if (isNodeFailed(cause)) return [...failureMismatches(example, cause.reason), ...ports.left()]
        // A coded error's message is its code: the line names the code and what it is about (`params.at`).
        if (isDomainError(cause)) {
            const at = cause.params["at"]
            const about = at === undefined ? "" : `: ${String(at)}`
            return [`threw ${cause.code}${about}`]
        }
        return [`threw ${cause instanceof Error ? cause.message : String(cause)}`]
    }
}

/** The two members of a problem a report line shows. */
interface ProblemLineSource {
    readonly code: string
    readonly at: string
}

/** A JSON-safe line of a problem. */
const problemLine = (problem: ProblemLineSource): string => `${problem.code}: ${problem.at}`

/**
 * Everything wrong with one template node, as lines: its definition problems, then each example's mismatches as
 * `<example name>: <mismatch>`. Empty means the node conforms. What a node spec calls: `expect(await checkTemplateNode(node)).toEqual([])`.
 */
export const checkTemplateNode = async (node: AnyTemplateNode): Promise<ReadonlyArray<string>> => {
    const problems = templateNodeProblems(node).map((problem) => problemLine(problem))
    const examples: ReadonlyArray<AnyExample> = node.examples
    const runs = await Promise.all(
        examples.map(async (example) =>
            (await templateExampleMismatches(node, example)).map((line) => `${example.name}: ${line}`),
        ),
    )
    return [...problems, ...runs.flat()]
}

/** The mismatches of every node of a list, by node id; empty means the list conforms (`nodeListMismatches`' twin for template nodes). */
export const templateNodeListMismatches = async (
    nodes: ReadonlyArray<AnyTemplateNode>,
): Promise<Readonly<Record<string, ReadonlyArray<string>>>> => {
    const checked = await Promise.all(nodes.map(async (node) => [node.id, await checkTemplateNode(node)] as const))
    return Object.fromEntries(checked.filter(([, lines]) => lines.length > 0))
}

/** A JSON value's type guard, for callers that hold a parsed answer. */
export const isJsonObject = (value: JsonValue): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)
