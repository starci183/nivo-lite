import type { DecisionRowView } from "../views/views.types"
import { decisionLinesOf } from "./decision-lines"

const row = (overrides: Partial<DecisionRowView>): DecisionRowView => ({
    id: "r1",
    title: "Quote for Hoa Sen",
    description: "Drafted, needs your approval.",
    badges: [],
    reason: null,
    amount: null,
    proposal: "",
    trace: null,
    expiry: null,
    primary: null,
    edit: null,
    menu: [],
    waitingFor: null,
    ...overrides,
})

describe("decisionLinesOf", () => {
    it("keeps a reason, a proposal and a trace line that each add something", () => {
        const lines = decisionLinesOf(
            row({ reason: "Over the limit", proposal: "Send 10 gift sets", trace: { line: "Rule 4", whyHref: null } }),
        )
        expect(lines).toEqual({ reason: "Over the limit", proposal: "Send 10 gift sets", trace: "Rule 4" })
    })

    it("drops a proposal that repeats the description, and a reason that repeats the title", () => {
        const lines = decisionLinesOf(row({ reason: "Quote for Hoa Sen", proposal: "Drafted, needs your approval." }))
        expect(lines).toEqual({ reason: null, proposal: null, trace: null })
    })

    it("drops a proposal that repeats the reason and a trace line that repeats the proposal", () => {
        const same = decisionLinesOf(row({ reason: "Same words", proposal: "Same words" }))
        expect(same.proposal).toBeNull()
        const trace = decisionLinesOf(row({ proposal: "Send now", trace: { line: " Send now ", whyHref: "/why" } }))
        expect(trace.trace).toBeNull()
    })

    it("draws nothing for blank lines", () => {
        expect(decisionLinesOf(row({ reason: "  ", proposal: " ", trace: { line: "", whyHref: null } }))).toEqual({
            reason: null,
            proposal: null,
            trace: null,
        })
    })
})
