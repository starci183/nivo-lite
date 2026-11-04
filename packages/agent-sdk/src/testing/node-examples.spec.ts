import { z } from "zod"
import { defineEffect } from "../node/effect"
import { defineNode } from "../node/node"
import type { NodeDefinition } from "../node/node.types"
import { nodeExampleMismatches, nodeListMismatches } from "./node-examples"
import { trusted } from "../schema/trusted"

const send = defineEffect({
    id: "channel.send",
    title: { key: "s" },
    payload: z.object({ text: z.string().max(200) }),
    rights: [],
})

const greet = trusted<NodeDefinition>(
    defineNode({
        id: "core.greet",
        role: "output",
        title: { key: "g" },
        params: z.object({ greeting: z.string().max(200) }),
        input: z.object({ name: z.string().max(200) }),
        output: z.object({ sent: z.boolean() }),
        rights: [],
        effects: ["channel.send"],
        run: async (input, context) => {
            const tone = await context.model.text({ purpose: "tone", instructions: "", input: input.name })
            await context.effect("channel.send", { text: `${context.params.greeting} ${input.name}${tone}` })
            return { sent: true }
        },
        examples: [
            {
                name: "greets",
                params: { greeting: "Hi" },
                input: { name: "An" },
                output: { sent: true },
                effects: [{ kind: "channel.send", payload: { text: "Hi An!" } }],
                model: ["!"],
                store: {},
            },
            {
                name: "by kind",
                params: { greeting: "Hi" },
                input: { name: "An" },
                output: { sent: true },
                effects: ["channel.send"],
                model: ["."],
                grant: { rights: [] },
            },
        ],
    }),
)

const [greets] = greet.examples

describe("node examples", () => {
    it("holds a node whose examples run as written", async () => {
        await expect(nodeListMismatches([greet], [send])).resolves.toEqual({})
    })

    it("names an output, an effect count, an effect kind and a payload that differ, and a throw", async () => {
        await expect(nodeExampleMismatches(greet, { ...greets, output: { sent: false } }, [send])).resolves.toEqual([
            "output differs",
        ])
        await expect(nodeExampleMismatches(greet, { ...greets, effects: [] }, [send])).resolves.toEqual([
            "effects: expected 0, ran 1",
        ])
        await expect(nodeExampleMismatches(greet, { ...greets, effects: ["core.other"] }, [send])).resolves.toEqual([
            "effect 0: expected core.other",
        ])
        const payload = { kind: "channel.send", payload: { text: "no" } } as const
        await expect(nodeExampleMismatches(greet, { ...greets, effects: [payload] }, [send])).resolves.toEqual([
            "effect 0: expected channel.send",
        ])
        await expect(nodeExampleMismatches(greet, greets, [])).resolves.toEqual(["threw EFFECT_UNKNOWN: channel.send"])
        const listed = await nodeListMismatches([greet], [])
        expect(Object.keys(listed)).toContain("core.greet / greets")
        expect(Array.isArray(listed["core.greet / greets"])).toBe(true)
    })

    it("names a thrown value that is no error", async () => {
        const throws = trusted<NodeDefinition>({ ...greet, run: () => Promise.reject("raw") })
        await expect(nodeExampleMismatches(throws, { ...greets, model: [] }, [send])).resolves.toEqual(["threw raw"])
    })
})
