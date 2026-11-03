import { z } from "zod"
import { defineNode } from "../node/node"
import { fakeNodeContext } from "./node-context"
import { runNodeExamples } from "./run-examples"

const THANKS = { id: "demo.thanks", payload: z.object({ text: z.string() }) } as const

const node = (over: { output?: unknown; effects?: ReadonlyArray<unknown>; modelAnswer?: unknown } = {}) =>
    defineNode({
        id: "demo.say",
        role: "output",
        title: { key: "demoSay" },
        params: z.object({ greeting: z.string() }),
        input: z.object({ name: z.string() }),
        output: z.object({ said: z.string() }),
        rights: [],
        effects: ["demo.thanks"],
        run: async (given, context) => {
            const text = `${String(context.params.greeting)} ${given.name}`
            await context.effect("demo.thanks", { kind: "message", id: "m1" }, { text })
            const word = await context.model.json(z.object({ word: z.string() }), {
                purpose: "demo-say",
                instructions: "say a word",
                input: given.name,
            })
            return { said: `${text} ${word.word}` }
        },
        examples: [
            {
                name: "greets",
                params: { greeting: "hi" },
                input: { name: "Lan" },
                model: [{ word: "ok" }],
                output: (over.output ?? { said: "hi Lan ok" }) as { said: string },
                effects: (over.effects ?? [{ kind: "demo.thanks", payload: { text: "hi Lan" } }]) as [],
            },
        ],
    })

describe("runNodeExamples", () => {
    it("answers no problem for a node that conforms to its examples", async () => {
        await expect(runNodeExamples(node(), [THANKS])).resolves.toEqual([])
        await expect(runNodeExamples(node({ effects: ["demo.thanks"] }), [THANKS])).resolves.toEqual([])
    })

    it("names the output, the effects and the payload that differ from the example", async () => {
        const problems = await runNodeExamples(
            node({ output: { said: "other" }, effects: [{ kind: "demo.thanks", payload: { text: "bye" } }] }),
            [THANKS],
        )
        expect(problems).toEqual([
            "demo.say: greets: the output differs from the example's",
            "demo.say: greets: the payload of demo.thanks differs from the example's",
        ])
        await expect(runNodeExamples(node({ effects: [] }), [THANKS])).resolves.toEqual([
            "demo.say: greets: the effects demo.thanks differ from the example's",
        ])
    })

    it("refuses a payload its effect's schema does not read", async () => {
        const strict = { id: "demo.thanks", payload: z.object({ text: z.number() }) } as const
        await expect(runNodeExamples(node(), [strict])).resolves.toEqual([
            "demo.say: greets: the payload of demo.thanks does not fit its schema",
        ])
    })

    it("refuses an example whose input or output does not fit the node's schemas", async () => {
        const bad = node()
        const badInput = { ...bad, examples: [{ ...bad.examples[0], input: { name: 1 } }] as unknown as typeof bad.examples }
        await expect(runNodeExamples(badInput)).resolves.toEqual([
            "demo.say: greets: the input does not fit the node's input schema",
        ])
        const badOutput = { ...bad, run: () => Promise.resolve({ said: 1 } as unknown as { said: string }) }
        await expect(runNodeExamples(badOutput)).resolves.toEqual([
            "demo.say: greets: the output does not fit the node's output schema",
        ])
    })
})

describe("fakeNodeContext model", () => {
    it("answers text and json from the canned answers in call order and refuses more asks than answers", async () => {
        const context = fakeNodeContext({ model: ["one", { word: "two" }], params: { a: 1 } })
        await expect(context.model.text({ purpose: "x", instructions: "i", input: null })).resolves.toBe("one")
        await expect(
            context.model.json(z.object({ word: z.string() }), { purpose: "x", instructions: "i", input: null }),
        ).resolves.toEqual({ word: "two" })
        expect(context.params).toEqual({ a: 1 })
        await expect(context.model.text({ purpose: "x", instructions: "i", input: null })).rejects.toThrow()
    })
})
