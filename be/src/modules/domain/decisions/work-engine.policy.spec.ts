import { builder } from "@starci/jest-preset"
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

const proposalOf = builder<Proposal>({ summary: "Quote", fields: { items: "tea", amount_vnd: 100 }, amount_vnd: 100 })

describe("work engine policy", () => {
    describe("customer outbound actions", () => {
        it("knows the actions that speak to the customer", () => {
            expect(isCustomerOutbound("send_quote")).toBe(true)
            expect(isCustomerOutbound("classify_lead")).toBe(false)
        })

        it("lets only the auto access run alone", () => {
            expect(accessLetsRunAlone("auto")).toBe(true)
            expect(accessLetsRunAlone("ask")).toBe(false)
            expect(accessLetsRunAlone("read")).toBe(false)
        })
    })

    describe("askBecause", () => {
        it("puts the reason first and drops the routine reason and the duplicate", () => {
            const verdict: GateVerdict = {
                verdict: "auto",
                reason: "routine",
                reasons: ["routine", "over_authority", "missing_data"],
                missing: [],
            }
            expect(askBecause(verdict, "over_authority")).toEqual({
                verdict: "ask",
                reason: "over_authority",
                reasons: ["over_authority", "missing_data"],
                missing: [],
            })
        })
    })

    describe("blockingReasons", () => {
        it("keeps only the reasons an approval cannot remove", () => {
            expect(blockingReasons(["over_authority", "missing_data", "unclear_outcome", "routine"])).toEqual([
                "missing_data",
                "unclear_outcome",
            ])
        })
    })

    describe("mergeEdits", () => {
        it("changes nothing when the edits repeat the proposal", () => {
            const before = proposalOf({ draft: "Hi" })
            const merged = mergeEdits(before, { draft: "Hi", amount_vnd: 100, fields: { items: "tea" } })
            expect(merged.changed).toBe(false)
            expect(merged.proposal).toEqual(before)
        })

        it("changes nothing when there are no edits", () => {
            const before = proposalOf()
            expect(mergeEdits(before, {})).toEqual({ proposal: before, changed: false })
        })

        it("applies a new draft", () => {
            const merged = mergeEdits(proposalOf({ draft: "Hi" }), { draft: "Hello" })
            expect(merged.proposal.draft).toBe("Hello")
            expect(merged.changed).toBe(true)
        })

        it("writes a new amount on the proposal and in its fields", () => {
            const merged = mergeEdits(proposalOf(), { amount_vnd: 250 })
            expect(merged.proposal.amount_vnd).toBe(250)
            expect(merged.proposal.fields.amount_vnd).toBe(250)
            expect(merged.changed).toBe(true)
        })

        it("clears the amount with null", () => {
            const merged = mergeEdits(proposalOf(), { amount_vnd: null })
            expect(merged.proposal.amount_vnd).toBeNull()
            expect(merged.proposal.fields.amount_vnd).toBeNull()
        })

        it("applies changed fields and keeps the others", () => {
            const merged = mergeEdits(proposalOf(), { fields: { items: "coffee", note: "gift" } })
            expect(merged.proposal.fields).toEqual({ items: "coffee", amount_vnd: 100, note: "gift" })
            expect(merged.proposal.amount_vnd).toBe(100)
            expect(merged.changed).toBe(true)
        })

        it("lets an edit of the amount field set the proposal's amount", () => {
            expect(mergeEdits(proposalOf(), { fields: { amount_vnd: 300 } }).proposal.amount_vnd).toBe(300)
            expect(mergeEdits(proposalOf(), { fields: { amount_vnd: "450" } }).proposal.amount_vnd).toBe(450)
            expect(mergeEdits(proposalOf(), { fields: { amount_vnd: null } }).proposal.amount_vnd).toBeNull()
            expect(mergeEdits(proposalOf(), { fields: { amount_vnd: "n/a" } }).proposal.amount_vnd).toBeNull()
        })

        it("keeps only the chosen candidate", () => {
            const candidates = [
                { id: "inv-1", label: "One", amount_vnd: 1 },
                { id: "inv-2", label: "Two", amount_vnd: 2 },
            ]
            const merged = mergeEdits(proposalOf({ candidates }), { candidateId: "inv-2" })
            expect(merged.proposal.candidates).toEqual([candidates[1]])
        })

        it("ignores a chosen candidate when the proposal has none", () => {
            expect(mergeEdits(proposalOf(), { candidateId: "inv-2" }).proposal.candidates).toBeUndefined()
        })
    })

    describe("reviewedByPerson", () => {
        it("clears the outcome of a proposal with one candidate", () => {
            const candidates = [{ id: "inv-1", label: "One", amount_vnd: 1 }]
            expect(reviewedByPerson(proposalOf({ candidates, outcome: "unclear" })).outcome).toBe("clear")
        })

        it("leaves a proposal with several candidates as it is", () => {
            const candidates = [
                { id: "inv-1", label: "One", amount_vnd: 1 },
                { id: "inv-2", label: "Two", amount_vnd: 2 },
            ]
            const proposal = proposalOf({ candidates, outcome: "unclear" })
            expect(reviewedByPerson(proposal)).toBe(proposal)
        })

        it("makes a proposal without candidates clear and fully confident", () => {
            expect(reviewedByPerson(proposalOf({ confidence: 0.4 }))).toEqual({
                ...proposalOf({ confidence: 0.4 }),
                outcome: "clear",
                confidence: 1,
            })
        })

        it("does not invent a confidence", () => {
            expect(reviewedByPerson(proposalOf())).toEqual({ ...proposalOf(), outcome: "clear" })
            expect(reviewedByPerson(proposalOf({ confidence: 1 })).confidence).toBe(1)
        })
    })

    describe("failureText", () => {
        it("takes the message of an error and cuts it", () => {
            expect(failureText(new RangeError("boom"))).toBe("boom")
            expect(failureText(new RangeError("x".repeat(MAX_ERROR_LENGTH + 10)))).toHaveLength(MAX_ERROR_LENGTH)
        })

        it("writes any other thrown value as text", () => {
            expect(failureText("nope")).toBe("nope")
        })
    })

    describe("formatVnd", () => {
        it("formats in the language of the reader", () => {
            expect(formatVnd(1500000, "en")).toContain("1,500,000")
            expect(formatVnd(1500000, "vi")).toContain("1.500.000")
        })
    })
})
