import { Test } from "@nestjs/testing"
import type { Proposal } from "./decisions.contracts"
import type { ProcessOptions } from "./work-engine.contracts"
import { processOptionsOf, proposalWithOptions } from "./work-options.policy"

const SUBJECT = Symbol("work-options.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { processOptionsOf, proposalWithOptions } }],
    }).compile()
    return moduleRef.get<{
        processOptionsOf: typeof processOptionsOf
        proposalWithOptions: typeof proposalWithOptions
    }>(SUBJECT)
}

const proposal: Proposal = { summary: "Supplied", fields: {}, draft: "Exact caller text" }

describe("durable work options", () => {
    it("leaves an ordinary proposal unchanged", async () => {
        const subject = await buildSubject()
        expect(subject.proposalWithOptions(proposal, {})).toBe(proposal)
        expect(subject.processOptionsOf(proposal)).toEqual({
            preset: undefined,
            noChain: undefined,
            forceAsk: undefined,
        })
    })

    it.each<ProcessOptions>([
        { preset: true },
        { noChain: true },
        { forceAsk: "over_authority" },
        { preset: false, noChain: false },
    ])("stores and recovers execution choices %o", async (options) => {
        const subject = await buildSubject()
        const stored = subject.proposalWithOptions(proposal, options)
        expect(stored.execution).toEqual({ preset: undefined, noChain: undefined, forceAsk: undefined, ...options })
        expect(subject.processOptionsOf(stored)).toEqual(stored.execution)
        expect(stored.draft).toBe("Exact caller text")
    })

    it("lets explicit immediate options override stored choices", async () => {
        const subject = await buildSubject()
        const stored = subject.proposalWithOptions(proposal, {
            preset: true,
            noChain: true,
            forceAsk: "over_authority",
        })
        expect(
            subject.processOptionsOf(stored, { preset: false, noChain: false, forceAsk: "unclear_outcome" }),
        ).toEqual({
            preset: false,
            noChain: false,
            forceAsk: "unclear_outcome",
        })
    })
})
