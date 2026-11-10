import { ENGINE_CORE_MODEL, nodeModelOf } from "@nivo-lite/blocks-core"
import { coreModelOf, declaredModelOf } from "./node-model.policy"

/** What blocks-core declares for a step, under whichever position its ALL_NODES_ON_CLAUDE switch is in (Auto or Sonnet). */
const declaredOf = (step: string): string | undefined => nodeModelOf(step)?.model

describe("declaredModelOf", () => {
    it("takes the model the graph's node names (the shop's choice), with blocks-core's weight for the step", () => {
        expect(declaredModelOf("chatbot.understand", "claude-sonnet-5-5")).toEqual({
            model: "claude-sonnet-5-5",
            weight: "light",
            source: "node",
        })
    })

    it("falls back to blocks-core's declaration for the step when the node names none (a graph copied before models)", () => {
        expect(declaredModelOf("accounting.match-payment", undefined)).toEqual({
            model: declaredOf("accounting.match-payment"),
            weight: "heavy",
            source: "declared",
        })
        expect(declaredModelOf("chatbot.understand", "")).toEqual({ model: declaredOf("chatbot.understand"), weight: "light", source: "declared" })
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
    it("is blocks-core's engine-core model on a heavy step: the AI core decides a report to the founder", () => {
        expect(coreModelOf()).toEqual({ model: ENGINE_CORE_MODEL.model, weight: "heavy", source: "declared" })
    })
})
