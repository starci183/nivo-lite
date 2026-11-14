import { z } from "../schema/zod-entry"
import { EXAMPLE_TURN } from "../tests/fixtures/node-examples"
import { scriptedNodePorts } from "../tests/fixtures/node-ports"
import type { FakeNodePortsOptions } from "../tests/fixtures/node-ports"
import { defineEffect } from "./effect"
import { runNode } from "./host"
import { defineNode } from "./node"

/**
 * An effect may have a wider `codePayload`: a finished card a step's CODE built from its records. The agent (the model) only ever
 * posts the `payload` shape, so what it types can never be a card: no amount on it comes from a model.
 */
const CARD = { kind: "pkg.card", total: 12 }
const WORDS = { kind: "words", text: "hello" }

const post = defineEffect({
    id: "nivo.tool.team.message.post",
    title: { key: "t" },
    payload: z.object({ kind: z.literal("words"), text: z.string() }),
    codePayload: z.union([
        z.object({ kind: z.literal("words"), text: z.string() }),
        z.object({ kind: z.literal("pkg.card"), total: z.number() }),
    ]),
})

const OUTPUT = z.object({ done: z.boolean() })

const nodeOf = (by: "code" | "agent") =>
    defineNode({
        id: "pkg.tell",
        role: "output",
        title: { key: "t" },
        params: z.object({}),
        input: z.object({}),
        output: OUTPUT,
        effects: ["nivo.tool.team.message.post"],
        run: async (_input, context) => {
            if (by === "code") {
                await context.effect("nivo.tool.team.message.post", CARD)
                return { done: true }
            }
            const decision = await context.agent.run({ goal: "Tell the team.", input: {}, output: OUTPUT, maxTurns: 3 })
            if (decision.kind === "confused") return context.confused(decision.confusion)
            return decision.value
        },
        examples: [
            {
                name: "tells",
                params: {},
                input: {},
                output: { done: true },
                effects: ["nivo.tool.team.message.post"],
                model: [{ done: { done: true } }],
            },
        ],
    })

const run = (by: "code" | "agent", options: FakeNodePortsOptions) => {
    const fake = scriptedNodePorts(options)
    const ran = runNode(
        {
            node: nodeOf(by),
            params: {},
            input: {},
            turn: EXAMPLE_TURN,
            grant: {},
            effects: new Map([[post.id, post]]),
            tools: new Map(),
            key: "run-1:tell",
        },
        fake.ports,
    )
    return { ran, fake }
}

describe("an effect's codePayload", () => {
    it("lets the step's own code post a finished card", async () => {
        const { ran, fake } = run("code", {})
        await expect(ran).resolves.toMatchObject({ output: { done: true } })
        expect(fake.executed.map((one) => one.payload)).toEqual([CARD])
    })

    it("never lets the agent post that card: the call is refused as a fact and nothing is executed", async () => {
        const { ran, fake } = run("agent", {
            model: [
                { call: { tool: "nivo.tool.team.message.post", args: CARD } },
                { call: { tool: "nivo.tool.team.message.post", args: WORDS } },
                { done: { done: true } },
            ],
        })
        await expect(ran).resolves.toMatchObject({ output: { done: true } })
        expect(fake.executed.map((one) => one.payload)).toEqual([WORDS])
    })
})
