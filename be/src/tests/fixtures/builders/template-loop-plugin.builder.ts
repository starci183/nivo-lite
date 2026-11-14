import { definePlugin, type Plugin } from "@nivo-lite/agent-sdk/installation"
import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    defineTemplateAgent,
    defineTemplateGraph,
    defineTemplateNode,
    endItem,
    ifNode,
    item,
    loop,
    node,
    outcome,
    ref,
    trigger,
    type TemplateAgent,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { jsonBodySchema } from "@modules/platform/primitives"

// THE TEMPLATE LOOP FIXTURE PLUGIN (slice G4, contract ADDENDUM 2 point 3): ONE template agent whose one graph loops over the orders
// its trigger hands it with a TWO-node body behind an `ifNode` that may end the item (`endItem`): `side` (a NON-blocking node) then
// `mark` (a blocking node, the item's `collect`), and a step after the loop. No node calls a tool: what is proved is the loop's road.

/** The template agent's key: the module of its graph. */
export const LOOP_AGENT = "tmloop"

/** The looping graph. */
export const LOOP_GRAPH = "tmloop.round"

/** The order id on which the side node fails (business failure): it is passed over and the item goes on. */
export const SIDE_FAILS = "bad-side"

/** The order id on which the blocking node fails: the run freezes at that item. */
export const MARK_FAILS = "bad-mark"

/** A side note per item: NON-blocking; it fails on `SIDE_FAILS`. */
export const sideNode = defineTemplateNode({
    id: "tmloop.side",
    title: { vi: "Ghi ch\u00fa ph\u1ee5", en: "Side note" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    blocking: false,
    input: z.object({ orderId: z.string().max(100) }),
    output: z.object({ seen: z.string().max(500) }),
    run: (input, ctx) =>
        input.orderId === SIDE_FAILS
            ? ctx.fail({ kind: "cannot", why: "side_unavailable" }, { orderId: input.orderId })
            : Promise.resolve({ seen: input.orderId }),
    examples: [{ name: "sees", params: {}, input: { orderId: "o1" }, output: { seen: "o1" } }],
})

/** The item's mark: blocking; it answers the run's item (`ctx.run.item`) and fails on `MARK_FAILS`. */
export const markNode = defineTemplateNode({
    id: "tmloop.mark",
    title: { vi: "\u0110\u00e1nh d\u1ea5u", en: "Mark" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({ orderId: z.string().max(100), seen: z.string().max(100) }),
    output: z.object({ orderId: z.string().max(500), seen: z.string().max(500), key: z.string().max(500), index: z.number() }),
    run: (input, ctx) =>
        input.orderId === MARK_FAILS
            ? ctx.fail({ kind: "cannot", why: "mark_refused" }, { orderId: input.orderId })
            : Promise.resolve({
                  orderId: input.orderId,
                  seen: input.seen,
                  key: ctx.run.item?.key ?? "",
                  index: ctx.run.item?.index ?? -1,
              }),
    examples: [
        {
            name: "marks",
            params: {},
            input: { orderId: "o1", seen: "o1" },
            output: { orderId: "o1", seen: "o1", key: "", index: -1 },
        },
    ],
})

/** The step after the loop: how many items it gathered. */
export const tallyNode = defineTemplateNode({
    id: "tmloop.tally",
    title: { vi: "\u0110\u1ebfm", en: "Tally" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({ items: z.array(z.object({ key: z.string().max(500), output: jsonBodySchema })).max(100) }),
    output: z.object({ count: z.number() }),
    run: (input) => Promise.resolve({ count: input.items.length }),
    examples: [{ name: "counts", params: {}, input: { items: [] }, output: { count: 0 } }],
})

const round = defineTemplateGraph({
    key: LOOP_GRAPH,
    title: { vi: "V\u00f2ng", en: "Round" },
    input: z.object({ orders: z.array(z.object({ orderId: z.string().max(500), skip: z.boolean() })).max(100) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "each",
    nodes: {
        // `concurrency: 1`: this world proves the SEQUENTIAL loop of template nodes; the fan-out of the same graph is proved beside it.
        each: loop({
            over: ref("trigger.orders"),
            key: "orderId",
            concurrency: 1,
            body: {
                start: "gate",
                collect: "mark",
                nodes: {
                    gate: ifNode({ when: { ref: item("skip"), op: "eq", value: true }, yes: endItem, no: "side" }),
                    side: node(sideNode, { input: { orderId: item("orderId") }, next: "mark" }),
                    mark: node(markNode, {
                        input: { orderId: item("orderId"), seen: ref("steps.side.output.seen", { default: "" }) },
                    }),
                },
            },
            next: "tally",
        }),
        tally: node(tallyNode, { input: { items: ref("steps.each.output.items") }, next: "done" }),
        done: outcome({ name: "done", output: { count: ref("steps.tally.output.count") } }),
    },
})

/** The template agent: its one graph, primary. */
export const LOOP_AGENT_TEMPLATE: TemplateAgent = defineTemplateAgent({
    key: LOOP_AGENT,
    label: { vi: "V\u00f2ng l\u1eb7p", en: "Loop" },
    accounts: [],
    graphs: [round],
    primary: LOOP_GRAPH,
})

/** The fixture plugin: the template agent only. */
export const LOOP_PLUGIN: Plugin = definePlugin({
    key: "tmloop",
    label: { vi: "V\u00f2ng l\u1eb7p", en: "Loop" },
    templateAgents: [LOOP_AGENT_TEMPLATE],
})
