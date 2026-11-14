import { definePlugin, type Plugin } from "@nivo-lite/agent-sdk/installation"
import { TOOL, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    defineTemplateAgent,
    defineTemplateGraph,
    defineTemplateNode,
    endRound,
    gte,
    loop,
    node,
    outcome,
    ref,
    toolOk,
    trigger,
    type TemplateAgent,
    type TemplateGraph,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { NOTE_WRITE, noteWriteEffect } from "./engine-core-plugin.builder"

// THE UNTIL LOOP FIXTURE PLUGIN (worker L3, `loop({ until })` on threads): ONE template agent whose graphs repeat a body until a
// condition, written with the SDK's `loop` builder: by DATA (`steps.count.output.n` reaches a bound), by MEANING (the body's routing node
// takes `stop`), capped (`max` runs out: the `exhausted` branch), and with a timed checkpoint between rounds (`every`). The body writes
// once per round (the ledger keeps each round's write apart) and reads a counter the spec scripts per call.

/** The template agent's key: the module of its graphs. */
export const UNTIL_AGENT = "tmuntil"

/** The loop by data: until `n >= 3`, at most 5 rounds. */
export const UNTIL_DATA = "tmuntil.data"

/** The loop by data with a cap of 2 rounds and a bound it never reaches in the spec. */
export const UNTIL_CAPPED = "tmuntil.capped"

/** The loop by data that waits 30 minutes between rounds: until `n >= 2`, at most 3 rounds. */
export const UNTIL_EVERY = "tmuntil.every"

/** The loop by meaning: until the judge takes `stop`, at most 5 rounds. */
export const UNTIL_MEANING = "tmuntil.meaning"

/** The wait between two rounds of `UNTIL_EVERY`, in minutes. */
export const UNTIL_EVERY_MINUTES = 30

/** The read every round makes: the counter (or the judge's word), scripted by the spec per call. */
export const UNTIL_READ = TOOL.contactGet

/** The write every round makes, with the same args each round (the generic fixture's test effect: the ledger keeps it once per call key). */
export const UNTIL_WRITE = NOTE_WRITE

/** Writes the lead's stage (the same args every round) and answers the round it ran in (`ctx.run.item`). */
export const untilNoteNode = defineTemplateNode({
    id: "tmuntil.note",
    title: { vi: "Ghi v\u00f2ng", en: "Round note" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [UNTIL_WRITE],
    mode: "auto",
    accounts: [],
    input: z.object({ leadId: z.string().max(100) }),
    output: z.object({ noted: z.boolean(), round: z.string().max(500), index: z.number() }),
    run: async (input, ctx) => {
        const written = await ctx.tools.call(UNTIL_WRITE, { noteId: input.leadId, text: "close" })
        return { noted: written.ok, round: ctx.run.item?.key ?? "", index: ctx.run.item?.index ?? -1 }
    },
    examples: [
        {
            name: "notes",
            params: {},
            input: { leadId: "l1" },
            tools: [{ id: UNTIL_WRITE, answer: toolOk({}) }],
            output: { noted: true, round: "", index: -1 },
        },
    ],
})

/** Reads the counter: `{ n }`; a read that says `fail` cannot go on (`ctx.fail`: the step freezes). */
export const untilCountNode = defineTemplateNode({
    id: "tmuntil.count",
    title: { vi: "\u0110\u1ebfm", en: "Count" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [UNTIL_READ],
    mode: "auto",
    accounts: [],
    input: z.object({}),
    output: z.object({ n: z.number() }),
    run: async (_input, ctx) => {
        const read = await ctx.tools.call(UNTIL_READ, {})
        if (read.ok && read.value["fail"] === true) return ctx.fail({ kind: "cannot", why: "counter_unavailable" }, {})
        const n: unknown = read.ok ? read.value["n"] : null
        return { n: typeof n === "number" ? n : 0 }
    },
    examples: [{ name: "counts", params: {}, input: {}, tools: [{ id: UNTIL_READ, answer: toolOk({ n: 1 }) }], output: { n: 1 } }],
})

/** Reads the judge's word and routes by it (`route`: `continue` or `stop`): the routing node a loop by meaning stops on. */
export const untilJudgeNode = defineTemplateNode({
    id: "tmuntil.judge",
    title: { vi: "X\u00e9t", en: "Judge" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [UNTIL_READ],
    mode: "auto",
    accounts: [],
    input: z.object({}),
    output: z.object({ route: z.enum(["continue", "stop"]) }),
    routes: { by: "route", names: ["continue", "stop"] },
    run: async (_input, ctx) => {
        const read = await ctx.tools.call(UNTIL_READ, {})
        return { route: read.ok && read.value["route"] === "stop" ? ("stop" as const) : ("continue" as const) }
    },
    examples: [
        { name: "goes on", params: {}, input: {}, tools: [{ id: UNTIL_READ, answer: toolOk({ route: "continue" }) }], output: { route: "continue" } },
    ],
})

/** What every graph of the agent takes: the lead its rounds write for. */
const INPUT = z.object({ leadId: z.string().max(500) })

/** A loop by data over the two-node body `note -> count`, until `n >= bound`, with its cap and wait, then `done` / `gaveup`. */
const dataGraph = (key: string, settings: { readonly bound: number; readonly max: 1 | 2 | 3 | 5; readonly every?: number }): TemplateGraph =>
    defineTemplateGraph({
        key,
        title: { vi: "V\u00f2ng \u0111\u1ebfn khi", en: "Until" },
        input: INPUT,
        triggers: [trigger(TRIGGER.workflowCalled)],
        openTo: "agent",
        start: "poll",
        nodes: {
            poll: loop({
                until: gte(ref("steps.count.output.n"), settings.bound),
                max: settings.max,
                ...(settings.every === undefined ? {} : { every: { minutes: settings.every } }),
                body: {
                    start: "note",
                    nodes: {
                        note: node(untilNoteNode, { input: { leadId: ref("trigger.leadId") }, next: "count" }),
                        count: node(untilCountNode, {}),
                    },
                },
                next: "done",
                exhausted: "gaveup",
            }),
            done: outcome({ name: "done", output: { rounds: ref("steps.poll.output.rounds") } }),
            gaveup: outcome({ name: "gaveup", output: { rounds: ref("steps.poll.output.rounds") } }),
        },
    })

/** The loop by data. */
export const untilDataGraph = dataGraph(UNTIL_DATA, { bound: 3, max: 5 })

/** The capped loop. */
export const untilCappedGraph = dataGraph(UNTIL_CAPPED, { bound: 99, max: 2 })

/** The loop that waits between rounds. */
export const untilEveryGraph = dataGraph(UNTIL_EVERY, { bound: 2, max: 3, every: UNTIL_EVERY_MINUTES })

/** The loop by meaning: one routing node whose `stop` ends the loop; either route ends the round. */
export const untilMeaningGraph: TemplateGraph = defineTemplateGraph({
    key: UNTIL_MEANING,
    title: { vi: "V\u00f2ng theo \u00fd", en: "Until judged" },
    input: INPUT,
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "ask",
    nodes: {
        ask: loop({
            until: { route: "judge", stop: "stop" },
            max: 5,
            body: { start: "judge", nodes: { judge: node(untilJudgeNode, { routes: { continue: endRound, stop: endRound } }) } },
            next: "done",
            exhausted: "gaveup",
        }),
        done: outcome({ name: "done", output: { rounds: ref("steps.ask.output.rounds") } }),
        gaveup: outcome({ name: "gaveup" }),
    },
})

/** The template agent: its four graphs, the loop by data primary. */
export const UNTIL_AGENT_TEMPLATE: TemplateAgent = defineTemplateAgent({
    key: UNTIL_AGENT,
    label: { vi: "V\u00f2ng \u0111\u1ebfn khi", en: "Until" },
    accounts: [],
    graphs: [untilDataGraph, untilCappedGraph, untilEveryGraph, untilMeaningGraph],
    primary: UNTIL_DATA,
})

/** The fixture plugin: the template agent only. */
export const UNTIL_PLUGIN: Plugin = definePlugin({
    key: "tmuntil",
    label: { vi: "V\u00f2ng \u0111\u1ebfn khi", en: "Until" },
    templateAgents: [UNTIL_AGENT_TEMPLATE],
    effects: [noteWriteEffect],
})
