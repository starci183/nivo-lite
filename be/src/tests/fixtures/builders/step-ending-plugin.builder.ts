import { definePlugin, type Plugin } from "@nivo-lite/agent-sdk/installation"
import { TOOL, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    defineTemplateAgent,
    defineTemplateGraph,
    defineTemplateNode,
    endRound,
    equals,
    loop,
    node,
    outcome,
    ref,
    toolOk,
    toolRefused,
    trigger,
    type NoticeFact,
    type StepUnsuccessful,
    type TemplateAgent,
    type TemplateGraph,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"

// THE STEP-ENDING FIXTURE PLUGIN (ruling R68, worker E-NOTICE): ONE template agent whose graphs hold PURE business (no notice node, no
// "was it refused" if) and declare their UNSUCCESSFUL endings with the SDK option, compiled by the SDK, adapted to @1 by the engine's
// adapter and run on threads: a customer send refused (`continue`), a send whose approval a person declines (`end` at `declined`), a node
// that says it cannot (`continue`), and an `until` loop that runs out of rounds (its notice, then `exhausted`).

/** The template agent's key: the module of its graphs. */
export const ENDING_AGENT = "tmend"

/** A send that may be refused; the run goes on to `after` (`then: continue`). */
export const ENDING_SEND = "tmend.send-on"

/** A send on `ask` whose approval may be declined; the run ends at `declined` (the default `end` of a main step). */
export const ENDING_ASK = "tmend.send-ask"

/** A node that may say it cannot; the run goes on (`continue`). */
export const ENDING_CANNOT = "tmend.cannot"

/** A loop that never meets its condition: two rounds, then its notice and `gaveup`. */
export const ENDING_ROUNDS = "tmend.rounds"

/** A check INSIDE an until loop's body that ends the run at `declined` when it cannot (E-FIX7: a declared end outcome leaves the loop). */
export const ENDING_ROUND_CANNOT = "tmend.round-cannot"

/** The words the send step says. */
export const ENDING_TEXT = "Don cua minh da san sang a."

/** The label of the order code the notices carry. */
export const ORDER_LABEL = { vi: "Mã đơn", en: "Order" } as const

const output = z.object({ sent: z.boolean(), refusal: z.string().max(100).nullable() })

/** Tells the customer of the run one line (the ONE customer send, addressed to the person the run serves) and says whether it went. */
export const endingTellNode = defineTemplateNode({
    id: "tmend.tell",
    title: { vi: "Nhắn khách", en: "Tell the customer" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [TOOL.customerMessageSend],
    mode: "auto",
    accounts: [],
    input: z.object({ text: z.string().min(1).max(500) }),
    output,
    run: async (input, ctx) => {
        const sent = await ctx.tools.call(TOOL.customerMessageSend, { text: input.text })
        if (sent.ok) return { sent: true, refusal: null }
        return { sent: false, refusal: sent.declined === true ? "declined" : sent.refusal }
    },
    examples: [
        {
            name: "sends",
            params: {},
            input: { text: "Hi" },
            tools: [{ id: TOOL.customerMessageSend, args: { text: "Hi" }, answer: toolOk({ sendKey: "k1", state: "delivered" }) }],
            output: { sent: true, refusal: null },
        },
        {
            name: "a refusal is said, never thrown",
            params: {},
            input: { text: "Hi" },
            tools: [{ id: TOOL.customerMessageSend, args: { text: "Hi" }, answer: toolRefused("outside_window") }],
            output: { sent: false, refusal: "outside_window" },
        },
    ],
})

/** Checks the order the run is about: it cannot when the code is empty (its own typed end, no failure). */
export const endingCheckNode = defineTemplateNode({
    id: "tmend.check",
    title: { vi: "Kiểm đơn", en: "Check the order" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({ code: z.string().max(100) }),
    output: z.object({ checked: z.string().max(100) }),
    run: (input, ctx) => Promise.resolve(input.code === "" ? ctx.fail({ kind: "cannot", why: "no_order_code" }) : { checked: input.code }),
    examples: [
        { name: "checks", params: {}, input: { code: "DH-1" }, output: { checked: "DH-1" } },
        { name: "cannot with no code", params: {}, input: { code: "" }, failure: { kind: "cannot", why: "no_order_code" } },
    ],
})

/** Notes the run went on: a node with no tool. */
export const endingNoteNode = defineTemplateNode({
    id: "tmend.note",
    title: { vi: "Ghi chú", en: "Note" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({ code: z.string().max(100) }),
    output: z.object({ noted: z.string().max(100) }),
    run: (input) => Promise.resolve({ noted: input.code }),
    examples: [{ name: "notes", params: {}, input: { code: "DH-1" }, output: { noted: "DH-1" } }],
})

/** What every graph is given: the line to say and the order code it is about (empty: no order). */
const INPUT = z.object({ text: z.string().max(500), code: z.string().max(100) })

/** The order code, as every notice of these graphs names it. */
const ORDER: NoticeFact = { label: ORDER_LABEL, value: ref("trigger.code") }

/** The send step with its declared unsuccessful ending. */
const tell = (unsuccessful: StepUnsuccessful) => node(endingTellNode, { input: { text: ref("trigger.text") }, next: "after", unsuccessful })

const after = node(endingNoteNode, { input: { code: ref("trigger.code") }, next: "done" })

/** A send that may be refused: the team is told and the run goes on (`continue`). Pure business: tell, note, done. */
export const endingSendGraph: TemplateGraph = defineTemplateGraph({
    key: ENDING_SEND,
    title: { vi: "Nhắn rồi đi tiếp", en: "Tell and go on" },
    input: INPUT,
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "tell",
    nodes: {
        tell: tell({ then: "continue", facts: [ORDER] }),
        after,
        done: outcome({ name: "done" }),
    },
})

/** A send on `ask`: a person declines it, the team is told and the run ends `declined` (a main step's default). */
export const endingAskGraph: TemplateGraph = defineTemplateGraph({
    key: ENDING_ASK,
    title: { vi: "Nhắn cần duyệt", en: "Tell after approval" },
    input: INPUT,
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "tell",
    nodes: {
        tell: node(endingTellNode, {
            input: { text: ref("trigger.text") },
            mode: "ask",
            next: "after",
            unsuccessful: { outcome: "declined", facts: [ORDER] },
        }),
        after,
        done: outcome({ name: "done" }),
        declined: outcome({ name: "declined" }),
    },
})

/** A check that may say it cannot: the team is told and the run goes on to the note (`continue`). */
export const endingCannotGraph: TemplateGraph = defineTemplateGraph({
    key: ENDING_CANNOT,
    title: { vi: "Kiểm rồi đi tiếp", en: "Check and go on" },
    input: INPUT,
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "check",
    nodes: {
        check: node(endingCheckNode, { input: { code: ref("trigger.code") }, next: "after", unsuccessful: { then: "continue", facts: [ORDER] } }),
        after,
        done: outcome({ name: "done" }),
    },
})

/** A loop that never meets its condition: two rounds of a note, then the team is told the order and the run takes `gaveup`. */
export const endingRoundsGraph: TemplateGraph = defineTemplateGraph({
    key: ENDING_ROUNDS,
    title: { vi: "Vòng hết lượt", en: "Rounds run out" },
    input: INPUT,
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "rounds",
    nodes: {
        rounds: loop({
            until: equals(ref("steps.note.output.noted", { default: null }), "never"),
            max: 2,
            body: { start: "note", nodes: { note: node(endingNoteNode, { input: { code: ref("trigger.code") }, next: endRound }) } },
            next: "done",
            exhausted: "gaveup",
            unsuccessful: { facts: [ORDER] },
        }),
        done: outcome({ name: "done" }),
        gaveup: outcome({ name: "gaveup" }),
    },
})

/**
 * A check inside an until loop's body that ends the run at `declined` when it cannot (`then: end`, written: a body step's default is
 * `continue`): no customer line, no tool (another kind of workflow than a send). R68 + R75 (E-FIX7): the declared end outcome is a route
 * of the step wherever it sits; leaving the loop this way clears its frame; the note after the check and the rounds after never run.
 */
export const endingRoundCannotGraph: TemplateGraph = defineTemplateGraph({
    key: ENDING_ROUND_CANNOT,
    title: { vi: "Kiểm trong vòng", en: "Check in a round" },
    input: INPUT,
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "rounds",
    nodes: {
        rounds: loop({
            until: equals(ref("steps.note.output.noted", { default: null }), "never"),
            max: 3,
            body: {
                start: "check",
                nodes: {
                    check: node(endingCheckNode, {
                        input: { code: ref("trigger.code") },
                        next: "note",
                        unsuccessful: { then: "end", outcome: "declined", facts: [ORDER] },
                    }),
                    note: node(endingNoteNode, { input: { code: ref("trigger.code") }, next: endRound }),
                },
            },
            next: "done",
            exhausted: "gaveup",
        }),
        done: outcome({ name: "done" }),
        gaveup: outcome({ name: "gaveup" }),
        declined: outcome({ name: "declined" }),
    },
})

/** The template agent: its graphs, the send primary. */
export const ENDING_AGENT_TEMPLATE: TemplateAgent = defineTemplateAgent({
    key: ENDING_AGENT,
    label: { vi: "Kết thúc bước", en: "Step endings" },
    accounts: [],
    graphs: [endingSendGraph, endingAskGraph, endingCannotGraph, endingRoundsGraph, endingRoundCannotGraph],
    primary: ENDING_SEND,
})

/** The fixture plugin: the template agent only. */
export const ENDING_PLUGIN: Plugin = definePlugin({
    key: ENDING_AGENT,
    label: { vi: "Kết thúc bước", en: "Step endings" },
    templateAgents: [ENDING_AGENT_TEMPLATE],
})
