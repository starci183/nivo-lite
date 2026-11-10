import { coreModelOf, declaredModelOf } from "./node-model.policy"

describe("declaredModelOf", () => {
    it("takes the model the graph's node names (the shop's choice), with blocks-core's weight for the step", () => {
        expect(declaredModelOf("chatbot.understand", "claude-sonnet-5-5")).toEqual({
            model: "claude-sonnet-5-5",
            weight: "light",
            source: "node",
        })
    })

    it("falls back to blocks-core's declaration for the step when the node names none (a graph copied before models)", () => {
        expect(declaredModelOf("accounting.match-payment", undefined)).toEqual({ model: "auto", weight: "heavy", source: "declared" })
        expect(declaredModelOf("chatbot.understand", "")).toEqual({ model: "auto", weight: "light", source: "declared" })
    })

    it("gives a step blocks-core declares nothing for the default model, weighed heavy", () => {
        expect(declaredModelOf("shop.own-node", undefined)).toEqual({
            model: "claude-sonnet-5-5",
            weight: "heavy",
            source: "default",
        })
    })
})

describe("coreModelOf", () => {
    it("is Auto on a heavy step: the AI core decides a report to the founder", () => {
        expect(coreModelOf()).toEqual({ model: "auto", weight: "heavy", source: "declared" })
    })
})
