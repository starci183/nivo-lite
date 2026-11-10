import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { coreNodes, TOOL } from "@nivo-lite/blocks-core"
import { driveFlow, flowServicesOf, flowWorldOf } from "@tests/fixtures/builders/flow-f-world.builder"
import * as policy from "./for-each.policy"

const SUBJECT = Symbol("for-each.policy")

/** The policy, bound as a kit double over its real functions. */
const subject = mock<typeof policy>({ ...policy })

/** The policy as Nest hands it to a caller. */
const buildPolicy = async (): Promise<typeof policy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: subject }],
    }).compile()
    return moduleRef.get<typeof policy>(SUBJECT)
}

/** The step of the loop's body: the front desk's answer, an agent that tells the customer with the customer send tool. */
const SAY_STEP = "chatbot.answer"

/** The purpose the body's agent asks the model under. */
const SAY_PURPOSE = `${SAY_STEP}:answer`

/** The turns of one iteration's agent: it sends the element's name to the customer, then answers the words it sent. */
const sayTurnsOf = (name: string): ReadonlyArray<Readonly<Record<string, unknown>>> => [
    { call: { tool: TOOL.customerMessageSend, args: { conversationId: "conv-1", text: name } } },
    { done: { reply: name } },
]

/** A loop over the trigger's flowers that tells the customer each one, then ends. */
const LOOP_GRAPH = (max = 50): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "chatbot",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: {
        rights: [
            ...(coreNodes.find((node) => node.id === SAY_STEP)?.rights ?? []),
            { kind: "message", access: "write", scope: "turn", fields: ["body"] },
        ],
        tools: [],
        effects: [TOOL.customerMessageSend],
    },
    nodes: [
        {
            key: "each",
            kind: "execute",
            step: "core.for-each",
            params: { max, items: { $ref: "trigger.context.flowers" } },
            routes: { body: "say" },
            next: "end",
        },
        {
            key: "say",
            kind: "output",
            step: SAY_STEP,
            params: { conversationId: { $ref: "trigger.conversationId" }, text: { $ref: "item.name" } },
        },
        { key: "end", kind: "output", step: "stop" },
    ],
})

const wakeOf = (flowers: ReadonlyArray<Readonly<Record<string, string>>>) => ({
    source: "tag",
    actorMemberId: null,
    context: { conversationId: "conv-1", authorAgentId: "sales-1", tagContext: JSON.stringify({ flowers }) },
})

describe("for-each.policy", () => {
    it("names the steps of an iteration and of its join, and reads the node back from either", async () => {
        const { iterationKeyOf, joinKeyOf, loopNodeKeyOf } = await buildPolicy()
        expect(iterationKeyOf("say", 2)).toBe("say[2]")
        expect(joinKeyOf("each", 1)).toBe("each#1")
        expect(loopNodeKeyOf("say[2]")).toBe("say")
        expect(loopNodeKeyOf("each#1")).toBe("each")
        expect(loopNodeKeyOf("plain")).toBe("plain")
    })

    it("sums the iterations in order, the failed ones apart, from the joins of the run", async () => {
        const { joinJsonOf, joinsOf, summaryJsonOf, summaryOf } = await buildPolicy()
        const earlier = {
            "each#0": { output: null, joined: joinJsonOf({ index: 0, output: { sent: true }, error: null }) },
            "each#1": {
                output: null,
                joined: { index: 1, output: null, error: { code: "out_of_stock", message: "Sold out" } },
            },
            "say[0]": { output: { sent: true } },
            "other#0": { joined: { index: 0 } },
        }
        const joins = joinsOf("each", earlier)
        expect(joins).toHaveLength(2)
        const summary = summaryOf(["a", "b", "c"], [...joins, { index: 2, output: 3, error: null }])
        expect(summaryJsonOf(summary)).toEqual({
            results: [
                { index: 0, item: "a", output: { sent: true } },
                { index: 2, item: "c", output: 3 },
            ],
            okCount: 2,
            failed: [{ index: 1, item: "b", error: { code: "out_of_stock", message: "Sold out" } }],
        })
        expect(summaryOf(["a"], []).results).toEqual([{ index: 0, item: "a", output: null }])
    })
})

describe("core.for-each driven by the engine", () => {
    it("runs the body once per element with the element in scope, each iteration under its own keys, then goes on", async () => {
        const world = flowWorldOf({ messages: [] })
        const graph = LOOP_GRAPH()
        const built = await flowServicesOf(world, graph, {
            [SAY_PURPOSE]: [...sayTurnsOf("Red roses"), ...sayTurnsOf("Orchids")],
        })

        const drive = await driveFlow(built, graph, wakeOf([{ name: "Red roses" }, { name: "Orchids" }]))

        expect(drive.failed).toBeNull()
        expect(drive.path).toEqual(["each", "say[0]", "each#0", "say[1]", "each#1", "end"])
        const sent = world.ran
            .filter((each) => each.effect === TOOL.customerMessageSend)
            .map((each) => each.payload.text)
        expect(sent).toEqual(["Red roses", "Orchids"])
        expect(drive.outputs["each#1"]?.output).toMatchObject({ okCount: 2, failed: [] })
    })

    it("ends at once with an empty summary for an empty list, and stops the run at the loop for a list past its max", async () => {
        const world = flowWorldOf({ messages: [] })
        const empty = await driveFlow(await flowServicesOf(world, LOOP_GRAPH(), {}), LOOP_GRAPH(), wakeOf([]))
        expect(empty.path).toEqual(["each", "end"])
        expect(empty.outputs.each?.output).toEqual({ results: [], okCount: 0, failed: [] })

        const short = LOOP_GRAPH(1)
        const long = await driveFlow(
            await flowServicesOf(world, short, {}),
            short,
            wakeOf([{ name: "a" }, { name: "b" }]),
        )
        // A list past the max is a business failure of the loop: no route takes it, the step stops there, the body never runs
        // and the one thing done is the report to the team.
        expect(long.path).toEqual([])
        expect(long.failed).toBe("each")
        expect(world.ran.map((each) => each.effect)).toEqual([TOOL.teamMessagePost])
        expect(world.ran[0]?.payload).toMatchObject({
            kind: "workflow.stopped",
            card: { by: "engine", facts: expect.arrayContaining([{ name: "code", value: "list_too_long" }]) },
        })
    })
})
