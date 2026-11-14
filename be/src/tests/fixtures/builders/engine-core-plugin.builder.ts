import { definePlugin, type Plugin } from "@nivo-lite/agent-sdk/installation"
import { defineEffect, defineTool } from "@nivo-lite/agent-sdk/node"
import { PROVIDER, TOOL, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    and,
    defineTemplateAgent,
    defineTemplateGraph,
    defineTemplateNode,
    equals,
    gt,
    ifNode,
    lt,
    node,
    not,
    or,
    outcome,
    memberContains,
    memberEquals,
    wait,
    waitFor,
    present,
    ref,
    toolOk,
    toolRefused,
    trigger,
    type NodeContext,
    type Ref,
    type TemplateAgent,
    type TemplateGraph,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"

// THE ENGINE CORE FIXTURE PLUGIN (worker E, TOOLS-LEAD, frame `nivo-frame.engineCoreFirst`): ONE neutral template agent ("notes") whose
// graphs are SMALL GENERIC TEST GRAPHS for the engine's core: routes by meaning, `ifNode` by data (and / or / not, present, order on
// numbers and ISO instants), a write under `auto` and under `ask` (declared on the node, or set on the graph step), an edge
// (`ctx.fail({ kind: "cannot" })`) between two writes, and the model per node. Its tools are ENGINE TEST DOUBLES, not business tools:
// test ids added to the SDK's open `ToolNames` below, declared by this plugin (a read as a tool, two writes as effects) and served by the
// world (`thread-world-outside.ts` answers the read, `executors` of a process act the writes). One write is LABELLED "money" for the
// owner (`toolLabels`, display only): the engine must run it exactly as the unlabelled one (frame `engineNoBusiness`).

declare module "@nivo-lite/agent-sdk/names" {
    interface ToolNames {
        "nivo.tool.test.note.read": import("@nivo-lite/agent-sdk/names").ToolSignature
        "nivo.tool.test.note.write": import("@nivo-lite/agent-sdk/names").Asking
        "nivo.tool.test.money.move": import("@nivo-lite/agent-sdk/names").Asking
    }
}

/** The template agent's key: the module of its graphs. */
export const CORE_AGENT = "tcore"

/** The read every reading node makes (a tool: it runs again on every visit). */
export const NOTE_READ = "nivo.tool.test.note.read"

/** The write of the write nodes (an installed effect: the ledger keeps it once per call key). */
export const NOTE_WRITE = "nivo.tool.test.note.write"

/** The same kind of write, labelled "money" for the owner (display only). */
export const MONEY_MOVE = "nivo.tool.test.money.move"

/** The agent's primary graph: woken by a line in a conversation (the world's customer channel); a check that may hit an edge, a write. */
export const CORE_INBOX = "tcore.inbox"
/** The routed graph: routes by meaning, then an `ifNode` by data, then a write. */
export const CORE_ROUTE = "tcore.route"
/** The edge graph: a write, a check that may hit an edge, a second write, an outcome. */
export const CORE_EDGE = "tcore.edge"
/** A write on a node declared `auto`. */
export const CORE_WRITE_AUTO = "tcore.write-auto"
/** A write on a node declared `ask`. */
export const CORE_WRITE_ASK = "tcore.write-ask"
/** A write on a node declared `ask` that acts through an account of the provider its node lists. */
export const CORE_WRITE_ASK_ON = "tcore.write-ask-on"
/** The money-labelled write on a node declared `auto`. */
export const CORE_MOVE_AUTO = "tcore.move-auto"
/** The money-labelled write, the graph step setting `ask` on a node declared `auto`. */
export const CORE_MOVE_ASK = "tcore.move-ask"
/** The model graph: a node of model `auto`, then a node of an explicit model. */
export const CORE_MODELS = "tcore.models"
/** A node with no model that calls its agent. */
export const CORE_NO_MODEL = "tcore.no-model"
/** A node whose AGENT (the model) calls the write itself, with the arguments it writes. */
export const CORE_AGENT_WRITE = "tcore.agent-write"
/** A node whose AGENT calls only DEFAULT tools (a read-context read, a record write) its node never lists; the step `auto`. */
export const CORE_AGENT_DEFAULTS = "tcore.agent-defaults"
/** The same node, the graph step setting `ask`. */
export const CORE_AGENT_DEFAULTS_ASK = "tcore.agent-defaults-ask"
/** A wait on the run for a line of its conversation (one naming the note's word first, else any), two hours at most. */
export const CORE_WAIT = "tcore.wait"
/** The minutes the wait graph waits. */
export const WAIT_MINUTES = 120
/**
 * A wait on the run for the completion of work its first step started, by a verb NO head trigger of the agent registers (the generic
 * `video.render.completed`: any compose provider's), matched by the work's own id; seeded active so the agent listens to it.
 */
export const CORE_AWAIT = "tcore.await"
/** The minutes the await graph waits. */
export const AWAIT_MINUTES = 30

/** The purpose the classify node's agent is asked under (the legacy loop: `<node id>:agent`). */
export const CLASSIFY_PURPOSE = "tcore.classify:agent"
/** The purpose of the `auto` model node's agent. */
export const AUTO_PURPOSE = "tcore.think-auto:agent"
/** The purpose of the explicit model node's agent. */
export const EXPLICIT_PURPOSE = "tcore.think-explicit:agent"
/** The purpose of the agent-write node's agent. */
export const AGENT_WRITE_PURPOSE = "tcore.agent-write:agent"
/** The purpose of the defaults node's agent. */
export const AGENT_DEFAULTS_PURPOSE = "tcore.agent-defaults:agent"
/** The purpose of the no-model node's agent (never asked). */
export const NO_MODEL_PURPOSE = "tcore.think-none:agent"

/** The explicit model of the explicit node. */
export const EXPLICIT_MODEL = "claude-haiku-5-5"

/** The instant the `ifNode` orders the classify's due instant against. */
export const DUE_BEFORE = "2026-12-01T00:00:00.000Z"

/** The score the `ifNode` asks the classify's score to be above. */
export const SCORE_ABOVE = 5

const ID_MAX = 100
const TEXT_MAX = 2000

/** The read: a test tool the world answers (`answers` of the rights), mutating nothing. */
export const noteReadTool = defineTool({
    id: NOTE_READ,
    title: { vi: "\u0110\u1ecdc ghi ch\u00fa", en: "Read note" },
    args: z.object({ noteId: z.string().max(ID_MAX).optional() }),
    result: z.looseObject({}),
    mutates: false,
})

/** The write: a test effect a process's `executors` act. */
export const noteWriteEffect = defineEffect({
    id: NOTE_WRITE,
    title: { vi: "Ghi ghi ch\u00fa", en: "Write note" },
    payload: z.object({ noteId: z.string().max(ID_MAX), text: z.string().max(TEXT_MAX) }),
})

/** The money-labelled write: the same shape, another id. */
export const moneyMoveEffect = defineEffect({
    id: MONEY_MOVE,
    title: { vi: "Chuy\u1ec3n ti\u1ec1n (th\u1eed)", en: "Move money (test)" },
    payload: z.object({ noteId: z.string().max(ID_MAX), text: z.string().max(TEXT_MAX) }),
})

const writeInput = z.object({ noteId: z.string().max(ID_MAX), text: z.string().max(TEXT_MAX) })
const writeOutput = z.object({ route: z.enum(["done", "declined"]), written: z.boolean() })

/** Writes once through `tool`; a person's decline (`declined`) routes the step to its `declined` branch, any other refusal fails. */
const writeOnce = async (
    tool: typeof NOTE_WRITE | typeof MONEY_MOVE,
    given: z.output<typeof writeInput>,
    ctx: NodeContext,
): Promise<z.input<typeof writeOutput>> => {
    const written = await ctx.tools.call(tool, { noteId: given.noteId, text: given.text })
    if (written.ok) return { route: "done", written: true }
    if (written.declined === true) return { route: "declined", written: false }
    return ctx.fail({ kind: "cannot", why: `write_refused:${written.refusal}` }, written.facts)
}

/** A write node over `tool`, declared in `mode`. */
const writeNodeOf = (id: `tcore.${string}`, tool: typeof NOTE_WRITE | typeof MONEY_MOVE, mode: "auto" | "ask") =>
    defineTemplateNode({
        id,
        title: { vi: "Ghi", en: "Write" },
        description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
        tools: [tool],
        mode,
        accounts: [],
        input: writeInput,
        output: writeOutput,
        routes: { by: "route", names: ["done", "declined"] },
        run: (given, ctx) => writeOnce(tool, given, ctx),
        examples: [
            {
                name: "writes",
                params: {},
                input: { noteId: "n1", text: "x" },
                tools: [{ id: tool, answer: toolOk({}) }],
                output: { route: "done", written: true },
            },
            {
                name: "declined",
                params: {},
                input: { noteId: "n1", text: "x" },
                tools: [{ id: tool, answer: toolRefused("declined") }],
                output: { route: "declined", written: false },
            },
        ],
    })

/**
 * The write declared `ask` that acts through an account of a provider its node LISTS (`telegram`, a fixture account: the test write is
 * no provider's purpose, so the node's list is what places it): detaching the agent from that account is the kill switch.
 */
export const writeAskOnNode = defineTemplateNode({
    id: "tcore.write-asked-on",
    title: { vi: "Ghi (qua t\u00e0i kho\u1ea3n)", en: "Write (through an account)" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [NOTE_WRITE],
    mode: "ask",
    accounts: [PROVIDER.telegram],
    input: writeInput,
    output: writeOutput,
    routes: { by: "route", names: ["done", "declined"] },
    run: (given, ctx) => writeOnce(NOTE_WRITE, given, ctx),
    examples: [
        {
            name: "writes",
            params: {},
            input: { noteId: "n1", text: "x" },
            tools: [{ id: NOTE_WRITE, answer: toolOk({}) }],
            output: { route: "done", written: true },
        },
    ],
})

/** The write declared `auto`. */
export const writeAutoNode = writeNodeOf("tcore.write", NOTE_WRITE, "auto")
/** The write declared `ask`. */
export const writeAskNode = writeNodeOf("tcore.write-asked", NOTE_WRITE, "ask")
/** The money-labelled write declared `auto` (its graph step may set `ask`). */
export const moveNode = writeNodeOf("tcore.move", MONEY_MOVE, "auto")

const classifyOutput = z.object({
    route: z.enum(["keep", "drop"]),
    score: z.number(),
    dueAt: z.iso.datetime().max(64),
    tag: z.string().max(40).nullable(),
})

/** Asks its agent (no tool) whether the note is kept: a routing node, by its own member `route` (routes by MEANING). */
export const classifyNode = defineTemplateNode({
    id: "tcore.classify",
    title: { vi: "Ph\u00e2n lo\u1ea1i", en: "Classify" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({ text: z.string().max(TEXT_MAX) }),
    output: classifyOutput,
    model: "auto",
    routes: { by: "route", names: ["keep", "drop"] },
    run: (given, ctx) =>
        ctx.agent.run({
            goal: "Say whether the note is kept, score it 0-10, say when it is due and tag it.",
            input: { text: given.text },
            output: classifyOutput,
            tools: [],
            maxTurns: 1,
        }),
    examples: [
        {
            name: "keeps",
            params: {},
            input: { text: "call back" },
            agent: [{ answer: { route: "keep", score: 7, dueAt: "2026-11-20T00:00:00.000Z", tag: "soon" } }],
            output: { route: "keep", score: 7, dueAt: "2026-11-20T00:00:00.000Z", tag: "soon" },
        },
    ],
})

const checkOutput = z.object({ checked: z.boolean(), at: z.string().max(500) })

/** Reads the note; while the read says `blocked` the node cannot go on (`ctx.fail`: the EDGE). It answers the run step's instant. */
export const checkNode = defineTemplateNode({
    id: "tcore.check",
    title: { vi: "Ki\u1ec3m tra", en: "Check" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [NOTE_READ],
    mode: "auto",
    accounts: [],
    input: z.object({ noteId: z.string().max(ID_MAX) }),
    output: checkOutput,
    run: async (given, ctx) => {
        const read = await ctx.tools.call(NOTE_READ, { noteId: given.noteId })
        if (read.ok && read.value["blocked"] === true) return ctx.fail({ kind: "cannot", why: "note_blocked" }, { noteId: given.noteId })
        return { checked: read.ok, at: ctx.run.at }
    },
    examples: [
        {
            name: "checks",
            params: {},
            input: { noteId: "n1" },
            tools: [{ id: NOTE_READ, answer: toolOk({ blocked: false }) }],
            output: { checked: true, at: "2026-01-05T09:00:00.000+07:00" },
        },
    ],
})

/** The longest words an agent answers (a step's output may be long: the checkpoint ceiling, not the schema, bounds it). */
const SAID_MAX = 20_000

const thinkOutput = z.object({ said: z.string().max(SAID_MAX) })

/** A node that asks its agent once under `model` (or none). With `think: false` it asks nothing (its example, for a node of no model). */
const thinkNodeOf = (id: `tcore.${string}`, model: "auto" | typeof EXPLICIT_MODEL | null) =>
    defineTemplateNode({
        id,
        title: { vi: "Ngh\u0129", en: "Think" },
        description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
        tools: [],
        mode: "auto",
        accounts: [],
        input: z.object({ text: z.string().max(TEXT_MAX), think: z.boolean() }),
        output: thinkOutput,
        ...(model === null ? {} : { model }),
        run: (given, ctx) =>
            given.think
                ? ctx.agent.run({ goal: "Say one line about the note.", input: { text: given.text }, output: thinkOutput, tools: [], maxTurns: 1 })
                : Promise.resolve({ said: "" }),
        examples: [{ name: "asks nothing", params: {}, input: { text: "x", think: false }, output: { said: "" } }],
    })

/** The node of model `auto`. */
export const thinkAutoNode = thinkNodeOf("tcore.think-auto", "auto")
/** The node of an explicit model. */
export const thinkExplicitNode = thinkNodeOf("tcore.think-explicit", EXPLICIT_MODEL)
/** The node of no model. */
export const thinkNoneNode = thinkNodeOf("tcore.think-none", null)

/** Hands its agent the write: the MODEL supplies the call's arguments (what a model may and may not reach is the engine's to bind). */
export const agentWriteNode = defineTemplateNode({
    id: "tcore.agent-write",
    title: { vi: "T\u00e1c t\u1eed ghi", en: "Agent writes" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [NOTE_WRITE],
    mode: "auto",
    accounts: [],
    input: z.object({ text: z.string().max(TEXT_MAX) }),
    output: thinkOutput,
    model: "auto",
    run: (given, ctx) =>
        ctx.agent.run({
            goal: "Write the note, then say what you wrote.",
            input: { text: given.text },
            output: thinkOutput,
            tools: [NOTE_WRITE],
            maxTurns: 3,
        }),
    examples: [
        {
            name: "writes",
            params: {},
            input: { text: "x" },
            agent: [{ answer: { said: "x" }, calls: [{ id: NOTE_WRITE, args: { noteId: "n1", text: "x" }, answer: toolOk({}) }] }],
            output: { said: "x" },
        },
    ],
})

/**
 * Hands its agent a subset of NONE of its own tools (it lists one outside tool, the test write): the agent still holds every default
 * (the read-context reads, the record and file tools), which the engine offers without listing.
 */
export const agentDefaultsNode = defineTemplateNode({
    id: "tcore.agent-defaults",
    title: { vi: "T\u00e1c t\u1eed d\u00f9ng c\u00f4ng c\u1ee5 m\u1eb7c \u0111\u1ecbnh", en: "Agent uses default tools" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [NOTE_WRITE],
    mode: "auto",
    accounts: [],
    input: z.object({ text: z.string().max(TEXT_MAX) }),
    output: thinkOutput,
    model: "auto",
    run: (given, ctx) =>
        ctx.agent.run({
            goal: "Look the truth up, keep a record of it, then say what you kept.",
            input: { text: given.text },
            output: thinkOutput,
            tools: [],
            maxTurns: 4,
        }),
    examples: [
        {
            name: "reads and records",
            params: {},
            input: { text: "x" },
            agent: [
                {
                    answer: { said: "x" },
                    calls: [
                        { id: TOOL.brainSearch, args: { query: "x" }, answer: toolOk({}) },
                        { id: TOOL.recordCreate, args: { type: "tcore.note", values: { text: "x" } }, answer: toolOk({}) },
                    ],
                },
            ],
            output: { said: "x" },
        },
    ],
})

/** What every graph of the agent takes: a note and its words. */
const INPUT = z.object({ noteId: z.string().max(500), text: z.string().max(500) })

/** A graph of the agent, called by a hand-off (`workflow.called`). */
const graphOf = (key: string, nodes: Parameters<typeof defineTemplateGraph>[0]["nodes"], start: string): TemplateGraph =>
    defineTemplateGraph({
        key,
        title: { vi: key, en: key },
        input: INPUT,
        triggers: [trigger(TRIGGER.workflowCalled)],
        openTo: "agent",
        start,
        nodes,
    })

const writeBindings = { noteId: ref("trigger.noteId"), text: ref("trigger.text") }

/**
 * Routes by MEANING (the classify's agent), then by DATA: kept when the tag is present AND the score is above `SCORE_ABOVE` AND (the
 * due instant is before `DUE_BEFORE` OR the tag is NOT `later`); then the write.
 */
export const routeGraph = graphOf(
    CORE_ROUTE,
    {
        classify: node(classifyNode, { input: { text: ref("trigger.text") }, routes: { keep: "gate", drop: "dropped" } }),
        gate: ifNode({
            when: and(
                present(ref("steps.classify.output.tag")),
                gt(ref("steps.classify.output.score"), SCORE_ABOVE),
                or(lt(ref("steps.classify.output.dueAt"), DUE_BEFORE), not(equals(ref("steps.classify.output.tag"), "later"))),
            ),
            yes: "write",
            no: "skipped",
        }),
        write: node(writeAutoNode, { input: writeBindings, routes: { done: "written", declined: "skipped" } }),
        written: outcome({ name: "written" }),
        skipped: outcome({ name: "skipped" }),
        dropped: outcome({ name: "dropped" }),
    },
    "classify",
)

/** A write, the check that may hit an edge, a second write (other words), the outcome. */
export const edgeGraph = graphOf(
    CORE_EDGE,
    {
        first: node(writeAutoNode, { input: writeBindings, routes: { done: "check", declined: "end" } }),
        check: node(checkNode, { input: { noteId: ref("trigger.noteId") }, next: "second" }),
        second: node(writeAutoNode, {
            input: { noteId: ref("trigger.noteId"), text: "second" },
            routes: { done: "end", declined: "end" },
        }),
        end: outcome({ name: "end", output: { at: ref("steps.check.output.at", { default: "" }) } }),
    },
    "first",
)

/** One write step on `step`, whose routes end on `done` or `declined`. */
const writeGraphOf = (key: string, step: ReturnType<typeof node>): TemplateGraph =>
    graphOf(key, { write: step, done: outcome({ name: "done" }), declined: outcome({ name: "declined" }) }, "write")

/** The write on a node declared `auto`. */
export const writeAutoGraph = writeGraphOf(
    CORE_WRITE_AUTO,
    node(writeAutoNode, { input: writeBindings, routes: { done: "done", declined: "declined" } }),
)
/** The write on a node declared `ask`. */
export const writeAskGraph = writeGraphOf(
    CORE_WRITE_ASK,
    node(writeAskNode, { input: writeBindings, routes: { done: "done", declined: "declined" } }),
)
/** The write declared `ask`, through the account of the provider its node lists. */
export const writeAskOnGraph = writeGraphOf(
    CORE_WRITE_ASK_ON,
    node(writeAskOnNode, { input: writeBindings, routes: { done: "done", declined: "declined" } }),
)
/** The money-labelled write, `auto` as its node declares. */
export const moveAutoGraph = writeGraphOf(
    CORE_MOVE_AUTO,
    node(moveNode, { input: writeBindings, routes: { done: "done", declined: "declined" } }),
)
/** The money-labelled write, the graph step setting `ask` (the workflow decides). */
export const moveAskGraph = writeGraphOf(
    CORE_MOVE_ASK,
    node(moveNode, { input: writeBindings, mode: "ask", routes: { done: "done", declined: "declined" } }),
)

/** A node of model `auto`, then a node of an explicit model. */
export const modelsGraph = graphOf(
    CORE_MODELS,
    {
        first: node(thinkAutoNode, { input: { text: ref("trigger.text"), think: true }, next: "second" }),
        second: node(thinkExplicitNode, { input: { text: ref("trigger.text"), think: true }, next: "done" }),
        done: outcome({ name: "done" }),
    },
    "first",
)

/** A node of no model that asks its agent. */
export const noModelGraph = graphOf(
    CORE_NO_MODEL,
    {
        none: node(thinkNoneNode, { input: { text: ref("trigger.text"), think: true }, next: "done" }),
        done: outcome({ name: "done" }),
    },
    "none",
)

/** The agent writes through its own tool call. */
export const agentWriteGraph = graphOf(
    CORE_AGENT_WRITE,
    { write: node(agentWriteNode, { input: { text: ref("trigger.text") }, next: "done" }), done: outcome({ name: "done" }) },
    "write",
)

/** The agent uses default tools only; the step `auto` (the node's). */
export const agentDefaultsGraph = graphOf(
    CORE_AGENT_DEFAULTS,
    { think: node(agentDefaultsNode, { input: { text: ref("trigger.text") }, next: "done" }), done: outcome({ name: "done" }) },
    "think",
)

/** The agent uses default tools only; the graph step sets `ask`: the record write waits for a person. */
export const agentDefaultsAskGraph = graphOf(
    CORE_AGENT_DEFAULTS_ASK,
    {
        think: node(agentDefaultsNode, { input: { text: ref("trigger.text") }, mode: "ask", next: "done" }),
        done: outcome({ name: "done" }),
    },
    "think",
)

/** A write of a fixed line, its text bound by the graph: the route the run took after the wait. */
const writeOnRoute = (text: Ref<string> | string) =>
    node(writeAutoNode, { input: { noteId: ref("trigger.noteId"), text }, routes: { done: "done", declined: "done" } })

/**
 * Writes the note, then WAITS on the same run: a line of the run's conversation that names the note's word (`trigger.word`) takes the
 * `named` route, any other line of that conversation the `replied` route, two hours without one the `timeout` route; each route writes
 * its own line (the event's text for a line).
 */
export const waitGraph: TemplateGraph = defineTemplateGraph({
    key: CORE_WAIT,
    title: { vi: "Ch\u1edd", en: "Wait" },
    input: z.object({ noteId: z.string().max(500), text: z.string().max(500), word: z.string().max(500), conversationId: z.string().max(500) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "first",
    nodes: {
        first: node(writeAutoNode, { input: writeBindings, routes: { done: "hold", declined: "hold" } }),
        hold: wait({
            for: {
                named: waitFor(TRIGGER.zaloMessageReceived, { match: [memberContains("data.text", ref("trigger.word"))] }),
                replied: waitFor(TRIGGER.zaloMessageReceived),
            },
            timeout: { minutes: WAIT_MINUTES },
            next: { named: "named", replied: "replied", timeout: "late" },
        }),
        named: writeOnRoute(ref("steps.hold.output.event.data.text")),
        replied: writeOnRoute(ref("steps.hold.output.event.data.text")),
        late: writeOnRoute("het gio"),
        done: outcome({ name: "done" }),
    },
})

/**
 * Writes the note (the step that starts the outside work, whose id is `trigger.ticket`), then WAITS on the same run for that work's
 * completion: an event of the generic render verb whose `renderId` is the run's ticket takes the `completed` route (its status written),
 * thirty minutes without one the `timeout` route. No graph of the agent registers the verb at its head: only this wait listens to it.
 */
export const awaitGraph: TemplateGraph = defineTemplateGraph({
    key: CORE_AWAIT,
    title: { vi: "Ch\u1edd vi\u1ec7c xong", en: "Await the work" },
    input: z.object({ noteId: z.string().max(500), text: z.string().max(500), ticket: z.string().max(500) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    // Seeded ACTIVE: the agent hears the verb its wait lists only through an active workflow.
    catalogue: {
        name: { vi: CORE_AWAIT, en: CORE_AWAIT },
        summary: { vi: CORE_AWAIT, en: CORE_AWAIT },
        version: 1,
        publishedAt: "2026-11-13T12:00:00.000Z",
        notes: { vi: CORE_AWAIT, en: CORE_AWAIT },
        seedActive: true,
    },
    start: "first",
    nodes: {
        first: node(writeAutoNode, { input: writeBindings, routes: { done: "hold", declined: "hold" } }),
        hold: wait({
            for: { completed: waitFor(TRIGGER.videoRenderCompleted, { match: [memberEquals("renderId", ref("trigger.ticket"))] }) },
            timeout: { minutes: AWAIT_MINUTES },
            next: { completed: "finished", timeout: "late" },
        }),
        finished: writeOnRoute(ref("steps.hold.output.event.status")),
        late: writeOnRoute("het gio"),
        done: outcome({ name: "done" }),
    },
})

const linesOutput = z.object({ route: z.enum(["done"]), written: z.number().int() })

/**
 * Writes the run's line, then the line of every event QUEUED on the run that this step took (`ctx.run.queue`, each the trigger scope its
 * event supplied; a person's WORDS are the engine's own line, not part of the event: the node writes the message key `data.messageKey`): a node that consumes its run's queue. Each write is its own call (its own key).
 */
export const writeLinesNode = defineTemplateNode({
    id: "tcore.write-lines",
    title: { vi: "Ghi c\u00e1c d\u00f2ng", en: "Write the lines" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [NOTE_WRITE],
    mode: "auto",
    accounts: [],
    input: writeInput,
    output: linesOutput,
    routes: { by: "route", names: ["done"] },
    run: async (given, ctx) => {
        const joined = ctx.run.queue.flatMap((event) => {
            const data = event.data
            const text: unknown = typeof data === "object" && data !== null ? Reflect.get(data, "messageKey") : undefined
            return typeof text === "string" ? [text] : []
        })
        for (const text of [given.text, ...joined]) {
            const written = await ctx.tools.call(NOTE_WRITE, { noteId: given.noteId, text })
            if (!written.ok) return ctx.fail({ kind: "cannot", why: `write_refused:${written.declined === true ? "declined" : written.refusal}` }, written.facts)
        }
        const done: z.input<typeof linesOutput> = { route: "done", written: 1 + joined.length }
        return done
    },
    examples: [
        {
            name: "writes the run's line and the queued one",
            params: {},
            input: { noteId: "n1", text: "x" },
            queue: [{ eventId: "e2", data: { messageKey: "y" } }],
            tools: [
                { id: NOTE_WRITE, answer: toolOk({}) },
                { id: NOTE_WRITE, answer: toolOk({}) },
            ],
            output: { route: "done", written: 2 },
        },
    ],
})

/**
 * Woken by a line in a conversation (the channel the world's customer writes on): checks the note the conversation is about (the edge
 * when the read says `blocked`), then writes the line and the line of every event queued on the run (`run.queue`). Its subject is the conversation: what the engine holds a second event of.
 */
export const inboxGraph: TemplateGraph = defineTemplateGraph({
    key: CORE_INBOX,
    title: { vi: "H\u1ed9p th\u01b0", en: "Inbox" },
    input: z.object({ eventId: z.string().max(500), routeId: z.string().max(500), data: z.object({ messageKey: z.string().max(500) }) }),
    triggers: [trigger(TRIGGER.zaloMessageReceived, { accounts: [PROVIDER.zaloOa] })],
    openTo: "any",
    start: "check",
    nodes: {
        check: node(checkNode, { input: { noteId: ref("trigger.routeId") }, next: "write" }),
        write: node(writeLinesNode, {
            input: { noteId: ref("trigger.routeId"), text: ref("trigger.data.messageKey") },
            routes: { done: "done" },
        }),
        done: outcome({ name: "done" }),
    },
})

/** The two graphs of the timer keying: each takes ONLY the due timers armed with its own `data.kind`. */
export const CORE_TIMER_A = "tcore.timer-a"
export const CORE_TIMER_B = "tcore.timer-b"

/** What a due timer hands a graph (`ref`, and `data`, the open flat record its arm gave). */
const TIMER_INPUT = z.object({
    eventId: z.string().max(500),
    data: z.object({
        ref: z.string().max(500),
        data: z
            .record(z.string().max(500), z.union([z.string().max(500), z.number(), z.boolean()]))
            .refine((data) => Object.keys(data).length <= 20),
    }),
})

/**
 * A graph woken by `nivo.trigger.timer.due` whose timer was armed with `data.kind = kind`: it writes the timer's `ref` and its kind (the
 * act shows what the run was handed). Two such graphs on one agent are the generic keying by a declared data field.
 */
const timerGraphOf = (key: string, kind: string): TemplateGraph =>
    defineTemplateGraph({
        key,
        title: { vi: key, en: key },
        input: TIMER_INPUT,
        triggers: [trigger(TRIGGER.timerDue, { where: [{ param: "data.data.kind", op: "equals", value: kind }] })],
        openTo: "any",
        // Seeded ACTIVE: the engine routes a due timer only to an active graph of the agent.
        catalogue: {
            name: { vi: key, en: key },
            summary: { vi: key, en: key },
            version: 1,
            publishedAt: "2026-11-13T12:00:00.000Z",
            notes: { vi: key, en: key },
            seedActive: true,
        },
        start: "write",
        nodes: {
            write: node(writeAutoNode, {
                input: { noteId: ref("trigger.data.ref"), text: kind },
                routes: { done: "done", declined: "done" },
            }),
            done: outcome({ name: "done" }),
        },
    })

/** The graph of the timers armed with `data.kind = "a"`. */
export const timerAGraph = timerGraphOf(CORE_TIMER_A, "a")
/** The graph of the timers armed with `data.kind = "b"`. */
export const timerBGraph = timerGraphOf(CORE_TIMER_B, "b")

/** The template agent: its graphs, the inbox primary. */
export const CORE_AGENT_TEMPLATE: TemplateAgent = defineTemplateAgent({
    key: CORE_AGENT,
    label: { vi: "L\u00f5i", en: "Core" },
    // A compose account serves the generic render verb the await graph's wait listens to (`WAIT_TRIGGER_UNSERVED` otherwise).
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.shotstack],
    graphs: [
        inboxGraph,
        routeGraph,
        edgeGraph,
        writeAutoGraph,
        writeAskGraph,
        writeAskOnGraph,
        moveAutoGraph,
        moveAskGraph,
        modelsGraph,
        noModelGraph,
        agentWriteGraph,
        agentDefaultsGraph,
        agentDefaultsAskGraph,
        waitGraph,
        awaitGraph,
        timerAGraph,
        timerBGraph,
    ],
    primary: CORE_INBOX,
})

/** The fixture plugin: the agent, its test read and writes, and the "money" label of one write (display only). */
export const CORE_PLUGIN: Plugin = definePlugin({
    key: "tcore",
    label: { vi: "L\u00f5i", en: "Core" },
    tools: [noteReadTool],
    effects: [noteWriteEffect, moneyMoveEffect],
    toolLabels: {
        [MONEY_MOVE]: {
            kind: "acts",
            title: { vi: "Ti\u1ec1n", en: "Money" },
            summary: { vi: "Chuy\u1ec3n ti\u1ec1n (nh\u00e3n hi\u1ec3n th\u1ecb)", en: "Moves money (a display label)" },
        },
    },
    templateAgents: [CORE_AGENT_TEMPLATE],
})
