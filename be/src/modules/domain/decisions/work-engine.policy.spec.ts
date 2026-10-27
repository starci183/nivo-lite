import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { AiGenerationsError, AiGenerationsErrorCode } from "@modules/domain/ai-generations"
import type { GateVerdict, Proposal } from "./decisions.contracts"
import {
    MAX_ERROR_LENGTH,
    accessLetsRunAlone,
    askBecause,
    blockingReasons,
    failureText,
    formatVnd,
    isCustomerOutbound,
    mergeEdits,
    reviewedByPerson,
} from "./work-engine.policy"

const SUBJECT = Symbol("work-engine.policy")

type Subject = Pick<
    typeof import("./work-engine.policy"),
    | "isCustomerOutbound"
    | "accessLetsRunAlone"
    | "askBecause"
    | "blockingReasons"
    | "mergeEdits"
    | "reviewedByPerson"
    | "failureText"
    | "formatVnd"
>

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isCustomerOutbound,
                    accessLetsRunAlone,
                    askBecause,
                    blockingReasons,
                    mergeEdits,
                    reviewedByPerson,
                    failureText,
                    formatVnd,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const proposalOf = builder<Proposal>({ summary: "Quote", fields: { items: "tea", amount_vnd: 100 }, amount_vnd: 100 })

describe("work engine policy", () => {
    describe("customer outbound actions", () => {
        it("knows the actions that speak to the customer", async () => {
            const subject = await build()

            expect(subject.isCustomerOutbound("send_quote")).toBe(true)
            expect(subject.isCustomerOutbound("classify_lead")).toBe(false)
        })

        it("lets only the auto access run alone", async () => {
            const subject = await build()

            expect(subject.accessLetsRunAlone("auto")).toBe(true)
            expect(subject.accessLetsRunAlone("ask")).toBe(false)
            expect(subject.accessLetsRunAlone("read")).toBe(false)
        })
    })

    describe("askBecause", () => {
        it("puts the reason first and drops the routine reason and the duplicate", async () => {
            const subject = await build()

            const verdict: GateVerdict = {
                verdict: "auto",
                reason: "routine",
                reasons: ["routine", "over_authority", "missing_data"],
                missing: [],
            }
            expect(subject.askBecause(verdict, "over_authority")).toEqual({
                verdict: "ask",
                reason: "over_authority",
                reasons: ["over_authority", "missing_data"],
                missing: [],
            })
        })
    })

    describe("blockingReasons", () => {
        it("keeps only the reasons an approval cannot remove", async () => {
            const subject = await build()

            expect(subject.blockingReasons(["over_authority", "missing_data", "unclear_outcome", "routine"])).toEqual([
                "missing_data",
                "unclear_outcome",
            ])
        })
    })
})

describe("work engine policy", () => {
    describe("mergeEdits", () => {
        it("changes nothing when the edits repeat the proposal", async () => {
            const subject = await build()

            const before = proposalOf({ draft: "Hi" })
            const merged = subject.mergeEdits(before, { draft: "Hi", amount_vnd: 100, fields: { items: "tea" } })
            expect(merged.changed).toBe(false)
            expect(merged.proposal).toEqual(before)
        })

        it("changes nothing when there are no edits", async () => {
            const subject = await build()

            const before = proposalOf()
            expect(subject.mergeEdits(before, {})).toEqual({ proposal: before, changed: false })
        })

        it("applies a new draft", async () => {
            const subject = await build()

            const merged = subject.mergeEdits(proposalOf({ draft: "Hi" }), { draft: "Hello" })
            expect(merged.proposal.draft).toBe("Hello")
            expect(merged.changed).toBe(true)
        })

        it("writes a new amount on the proposal and in its fields", async () => {
            const subject = await build()

            const merged = subject.mergeEdits(proposalOf(), { amount_vnd: 250 })
            expect(merged.proposal.amount_vnd).toBe(250)
            expect(merged.proposal.fields.amount_vnd).toBe(250)
            expect(merged.changed).toBe(true)
        })

        it("clears the amount with null", async () => {
            const subject = await build()

            const merged = subject.mergeEdits(proposalOf(), { amount_vnd: null })
            expect(merged.proposal.amount_vnd).toBeNull()
            expect(merged.proposal.fields.amount_vnd).toBeNull()
        })

        it("applies changed fields and keeps the others", async () => {
            const subject = await build()

            const merged = subject.mergeEdits(proposalOf(), { fields: { items: "coffee", note: "gift" } })
            expect(merged.proposal.fields).toEqual({ items: "coffee", amount_vnd: 100, note: "gift" })
            expect(merged.proposal.amount_vnd).toBe(100)
            expect(merged.changed).toBe(true)
        })

        it("lets an edit of the amount field set the proposal's amount", async () => {
            const subject = await build()

            expect(subject.mergeEdits(proposalOf(), { fields: { amount_vnd: 300 } }).proposal.amount_vnd).toBe(300)
            expect(subject.mergeEdits(proposalOf(), { fields: { amount_vnd: "450" } }).proposal.amount_vnd).toBe(450)
            expect(subject.mergeEdits(proposalOf(), { fields: { amount_vnd: null } }).proposal.amount_vnd).toBeNull()
            expect(subject.mergeEdits(proposalOf(), { fields: { amount_vnd: "n/a" } }).proposal.amount_vnd).toBeNull()
        })

        it("keeps only the chosen candidate", async () => {
            const subject = await build()

            const candidates = [
                { id: "inv-1", label: "One", amount_vnd: 1 },
                { id: "inv-2", label: "Two", amount_vnd: 2 },
            ]
            const merged = subject.mergeEdits(proposalOf({ candidates }), { candidateId: "inv-2" })
            expect(merged.proposal.candidates).toEqual([candidates[1]])
        })

        it("ignores a chosen candidate when the proposal has none", async () => {
            const subject = await build()

            expect(subject.mergeEdits(proposalOf(), { candidateId: "inv-2" }).proposal.candidates).toBeUndefined()
        })
    })
})

describe("work engine policy", () => {
    describe("reviewedByPerson", () => {
        it("clears the outcome of a proposal with one candidate", async () => {
            const subject = await build()

            const candidates = [{ id: "inv-1", label: "One", amount_vnd: 1 }]
            expect(subject.reviewedByPerson(proposalOf({ candidates, outcome: "unclear" })).outcome).toBe("clear")
        })

        it("leaves a proposal with several candidates as it is", async () => {
            const subject = await build()

            const candidates = [
                { id: "inv-1", label: "One", amount_vnd: 1 },
                { id: "inv-2", label: "Two", amount_vnd: 2 },
            ]
            const proposal = proposalOf({ candidates, outcome: "unclear" })
            expect(subject.reviewedByPerson(proposal)).toBe(proposal)
        })

        it("makes a proposal without candidates clear and fully confident", async () => {
            const subject = await build()

            expect(subject.reviewedByPerson(proposalOf({ confidence: 0.4 }))).toEqual({
                ...proposalOf({ confidence: 0.4 }),
                outcome: "clear",
                confidence: 1,
            })
        })

        it("does not invent a confidence", async () => {
            const subject = await build()

            expect(subject.reviewedByPerson(proposalOf())).toEqual({ ...proposalOf(), outcome: "clear" })
            expect(subject.reviewedByPerson(proposalOf({ confidence: 1 })).confidence).toBe(1)
        })
    })
})

describe("work engine policy failure text", () => {
    describe("failureText", () => {
        const CATALOG: Readonly<Record<string, string>> = {
            "errors.AI_GENERATIONS_FAILED": "{{message}}",
            "errors.WORK_PERFORMERS_SUBJECT_MISSING": "This work is not tied to a customer.",
            "engine.failedUnknown": "NIVO could not finish this step.",
        }
        const say = (key: string, params: Readonly<Record<string, string | number>>): string =>
            (CATALOG[key] ?? key).replace(/\{\{(\w+)\}\}/g, (whole, name: string) => String(params[name] ?? whole))

        it("takes the message of an error and cuts it", async () => {
            const subject = await build()

            expect(subject.failureText(new RangeError("boom"), say)).toBe("boom")
            expect(subject.failureText(new RangeError("x".repeat(MAX_ERROR_LENGTH + 10)), say)).toHaveLength(
                MAX_ERROR_LENGTH,
            )
        })

        it("writes any other thrown value as text", async () => {
            const subject = await build()

            expect(subject.failureText("nope", say)).toBe("nope")
        })

        it("turns a capability error into its sentence, filled with its values", async () => {
            const subject = await build()
            const busy = new AiGenerationsError({
                code: AiGenerationsErrorCode.GenerationFailed,
                params: { reason: "error", message: "NIVO is busy, try again." },
            })

            expect(subject.failureText(busy, say)).toBe("NIVO is busy, try again.")
            expect(subject.failureText(new RangeError("WORK_PERFORMERS_SUBJECT_MISSING"), say)).toBe(
                "This work is not tied to a customer.",
            )
        })

        it("never shows a code: one without a sentence, or a sentence missing its value, reads as the plain failure", async () => {
            const subject = await build()
            const bare = new AiGenerationsError({ code: AiGenerationsErrorCode.GenerationFailed })

            expect(subject.failureText(bare, say)).toBe("NIVO could not finish this step.")
            expect(subject.failureText("AI_GENERATIONS_FAILED", say)).toBe("NIVO could not finish this step.")
            expect(subject.failureText(new RangeError("SOME_UNKNOWN_CODE"), say)).toBe(
                "NIVO could not finish this step.",
            )
        })
    })
})

describe("work engine policy money", () => {
    describe("formatVnd", () => {
        it("formats in the language of the reader", async () => {
            const subject = await build()

            expect(subject.formatVnd(1500000, "en")).toContain("1,500,000")
            expect(subject.formatVnd(1500000, "vi")).toContain("1.500.000")
        })
    })
})
