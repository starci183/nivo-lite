import { Test } from "@nestjs/testing"
import type { AiChatAnswer, AiCutSpend } from "./ai.contracts"
import { spendOf } from "./try-spend.policy"

const SUBJECT = Symbol("try-spend.policy")
type Subject = { spendOf: typeof spendOf }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { spendOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const USAGE = { promptTokens: 900, completionTokens: 200, totalTokens: 1100, costUsd: null }
const SERVED = { upstream: "anthropic", finishReason: "max_tokens", durationMs: 1200 }

const answer: AiChatAnswer = {
    text: "{}",
    parsed: null,
    model: "claude-haiku-5-5",
    usage: USAGE,
    retrieved: 0,
    served: SERVED,
}
const cut: AiCutSpend = { model: "claude-haiku-5-5", usage: USAGE, served: SERVED, cap: 200 }

describe("spendOf", () => {
    it("reads an answer with its usage and the characters it wrote", async () => {
        const subject = await build()
        expect(subject.spendOf({ ok: true, answer })).toEqual({
            model: "claude-haiku-5-5",
            usage: USAGE,
            completionChars: 2,
            served: SERVED,
        })
    })

    it("reads a try cut at its cap, or answered empty, with what it still reported and its failure: booked, never billed", async () => {
        const subject = await build()
        expect(subject.spendOf({ ok: false, failure: "length", spent: cut })).toEqual({
            model: "claude-haiku-5-5",
            usage: USAGE,
            completionChars: 0,
            failure: "length",
            served: SERVED,
        })
        expect(subject.spendOf({ ok: false, failure: "empty", spent: cut })).toMatchObject({
            usage: USAGE,
            failure: "empty",
        })
    })

    it("marks no failure on an answer: the try that answers is the one billed", async () => {
        const subject = await build()
        expect(subject.spendOf({ ok: true, answer })).not.toHaveProperty("failure")
    })

    it("has nothing to book for a try that returned nothing", async () => {
        const subject = await build()
        for (const failure of ["timeout", "provider", "unconfigured"] as const)
            expect(subject.spendOf({ ok: false, failure })).toBeNull()
    })
})
