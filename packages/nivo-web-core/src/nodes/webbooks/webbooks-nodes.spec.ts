import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { webbooksNodes } from "./webbooks-nodes"

/** The chat turn is the team-answer factory's (its own spec checks it); every other step of the module is checked here. */
const TEAM_ANSWER = "webbooks.team-answer"

describe("the steps of the Accounting agent (webbooks)", () => {
    it.each(webbooksNodes.filter((node) => node.id !== TEAM_ANSWER).map((node) => [node.id, node] as const))(
        "%s conforms: its definition and every example hold",
        async (_id, node) => {
            expect(await checkTemplateNode(node)).toEqual([])
        },
    )

    it("lists every step of the module once, the chat turn last", () => {
        expect(webbooksNodes.map((node) => node.id)).toEqual([
            "webbooks.payment-credit",
            "webbooks.payment-open",
            "webbooks.payment-settle",
            "webbooks.renewal-paid",
            "webbooks.renewal-paid-team",
            "webbooks.purchase-paid",
            "webbooks.purchase-paid-team",
            "webbooks.invoice-draft",
            "webbooks.invoice-issue",
            "webbooks.invoice-mail",
            "webbooks.invoice-team",
            "webbooks.due",
            "webbooks.notice-team",
            "webbooks.notice-draft",
            "webbooks.notice-record",
            "webbooks.round-report",
            "webbooks.supplier-check",
            "webbooks.supplier-note",
            "webbooks.supplier-report",
            TEAM_ANSWER,
        ])
    })

    it("names a model only on the steps that call the AI", () => {
        const withoutModel = webbooksNodes.filter((node) => node.model === undefined).map((node) => node.id)
        expect(withoutModel).toEqual([
            "webbooks.payment-credit",
            "webbooks.payment-open",
            "webbooks.renewal-paid",
            "webbooks.purchase-paid",
            "webbooks.invoice-issue",
            "webbooks.notice-record",
            "webbooks.supplier-note",
        ])
    })
})
