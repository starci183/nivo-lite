import { Test } from "@nestjs/testing"
import { ENGINE_CORE_MODEL } from "@nivo-lite/agent-sdk/models"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { coreModelOf, declaredModelOf, declaredWorkOf } from "./node-model.policy"

const SUBJECT = Symbol("node-model.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { coreModelOf, declaredModelOf, declaredWorkOf } }],
    }).compile()
    return moduleRef.get<typeof import("./node-model.policy")>(SUBJECT)
}

/** What blocks-core declares for a step, under whichever position its ALL_NODES_ON_CLAUDE switch is in (Auto or Sonnet). */
const declaredOf = (step: string): string | undefined => INSTALLED.nodeModelOf(step)?.model

describe("declaredModelOf", () => {
    it("takes the model the graph's node names (the shop's choice), with blocks-core's weight for the step", async () => {
        const subject = await build()
        expect(subject.declaredModelOf("chatbot.understand", "claude-sonnet-5-5")).toEqual({
            model: "claude-sonnet-5-5",
            weight: "light",
            source: "node",
        })
    })

    it("falls back to blocks-core's declaration for the step when the node names none (a graph copied before models)", async () => {
        const subject = await build()
        // (The heavy example of this line, `accounting.match-payment`, left with the money, wave 4: a step that declares its output cap stands for it.)
        expect(subject.declaredModelOf("sales.consult-turn", undefined)).toEqual({
            ...INSTALLED.nodeModelOf("sales.consult-turn"),
            weight: "light",
            source: "declared",
        })
        expect(subject.declaredModelOf("chatbot.understand", "")).toEqual({ model: declaredOf("chatbot.understand"), weight: "light", source: "declared" })
    })

    it("gives a step blocks-core declares nothing for the default model, weighed heavy", async () => {
        const subject = await build()
        expect(subject.declaredModelOf("shop.own-node", undefined)).toEqual({
            model: "claude-sonnet-5-5",
            weight: "heavy",
            source: "default",
        })
    })
})

describe("coreModelOf", () => {
    it("is blocks-core's engine-core model on a heavy step: the AI core decides a report to the founder", async () => {
        const subject = await build()
        expect(subject.coreModelOf()).toEqual({ model: ENGINE_CORE_MODEL.model, weight: "heavy", source: "declared" })
    })
})

describe("the output bound and the work blocks-core declares beside a step's model (ENG1)", () => {
    it("carries the step's output bound whatever model the shop picked, and none for a step that declares none", async () => {
        const subject = await build()
        expect(subject.declaredModelOf("sales.consult-turn", undefined).maxOutputTokens).toBe(1200)
        expect(subject.declaredModelOf("sales.consult-turn", "claude-haiku-5-5")).toMatchObject({ source: "node", maxOutputTokens: 1200 })
        expect(subject.declaredModelOf("team.chat", undefined).maxOutputTokens).toBe(1200)
        expect(subject.declaredModelOf("chatbot.understand", undefined)).not.toHaveProperty("maxOutputTokens")
        expect(subject.declaredModelOf("shop.own-node", undefined)).not.toHaveProperty("maxOutputTokens")
    })

    it("declares the team chat's answer a chat turn, and every other step plain node work", async () => {
        const subject = await build()
        expect(subject.declaredWorkOf("team.chat")).toBe("chat_turn")
        expect(subject.declaredWorkOf("sales.consult-turn")).toBeUndefined()
        expect(subject.declaredWorkOf("shop.own-node")).toBeUndefined()
    })
})
