import { proposalOf } from "../../rows/chatbot/proposal"
import { PROPOSAL_FIELDS } from "../../rows/chatbot/inbox-fields"
import { settingsProblemsOf } from "../../rules/chatbot/settings"
import {
    APPROVAL_FIXTURES,
    CONTACT_FIXTURES,
    PROPOSAL,
    RULES_FIXTURES,
    SETTINGS,
    THREAD_COUNTS,
    THREAD_LIST_FIXTURES,
    THREAD_RECORDS,
} from "./inbox.fixtures"

describe("the inbox fixtures", () => {
    it("hold the five states of every read", () => {
        for (const fixtures of [THREAD_LIST_FIXTURES, CONTACT_FIXTURES, APPROVAL_FIXTURES, RULES_FIXTURES]) {
            expect(Object.keys(fixtures)).toEqual(["ready", "loading", "empty", "error", "forbidden"])
        }
        expect(THREAD_LIST_FIXTURES.ready).toEqual({ items: THREAD_RECORDS })
        expect(THREAD_LIST_FIXTURES.forbidden).toEqual({ isForbidden: true })
    })

    it("count the tabs of the board", () => {
        expect(THREAD_COUNTS.total).toBe(12)
        expect(THREAD_COUNTS.counts).toEqual({ needs: 3, today: 8 })
    })

    it("give a proposal the card reads and settings the rules accept", () => {
        expect(proposalOf(PROPOSAL, PROPOSAL_FIELDS)?.id).toBe("p1")
        expect(settingsProblemsOf(SETTINGS)).toEqual([])
    })
})
