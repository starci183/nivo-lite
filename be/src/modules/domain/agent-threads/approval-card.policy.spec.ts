import { z } from "zod"
import { defineAgentMessageKind, type AgentMessageKind } from "@nivo-lite/agent-sdk/team-chat"
import { callWordsOf } from "@modules/domain/tools"
import { APPROVAL_CARD_SHAPE, approvalFactsOf, callLabelOf, declaredTextOf, previewOf } from "./approval-card.policy"

const ORDER_KIND = defineAgentMessageKind({
    id: "sales.order.summary",
    payload: z.object({ orderNo: z.string(), totalVnd: z.number().int() }),
    actions: { approve: false, edit: "none", reject: false },
})

const kindOf = (id: string): AgentMessageKind | null => (id === ORDER_KIND.id ? ORDER_KIND : id === "approval.decision" ? ORDER_KIND : null)

describe("approval card policy (nivo-frame team-chat rule 9)", () => {
    it("words the facts by code from the real arguments, never an AI's words", () => {
        expect(approvalFactsOf(callWordsOf({ orderNo: "DH-7", amountVnd: 5000, note: undefined }))).toEqual([
            { name: "orderNo", value: "DH-7" },
            { name: "amountVnd", value: "5000" },
        ])
        expect(approvalFactsOf(callWordsOf(null))).toEqual([])
        expect(approvalFactsOf([{ name: "n".repeat(90), value: "v".repeat(500) }])[0]?.value).toHaveLength(400)
    })

    it("keeps a preview of a kind a package registered whose payload passes the kind's schema", () => {
        expect(previewOf({ kind: "sales.order.summary", payload: { orderNo: "DH-7", totalVnd: 200000 } }, kindOf)).toEqual({
            kind: "sales.order.summary",
            payload: { orderNo: "DH-7", totalVnd: 200000 },
        })
    })

    it("drops a preview whose payload fails its schema, of an unregistered kind, of a core kind, or of no shape", () => {
        expect(previewOf({ kind: "sales.order.summary", payload: { orderNo: 7 } }, kindOf)).toBeNull()
        expect(previewOf({ kind: "nobody.kind", payload: {} }, kindOf)).toBeNull()
        expect(previewOf({ kind: "approval.decision", payload: { orderNo: "x", totalVnd: 1 } }, kindOf)).toBeNull()
        expect(previewOf("sales.order.summary", kindOf)).toBeNull()
        expect(previewOf(null, kindOf)).toBeNull()
    })

    it("reads a declared two-language text in the team's language", () => {
        expect(declaredTextOf({ vi: "Gửi mã QR", en: "Send the QR" }, "en")).toBe("Send the QR")
        expect(declaredTextOf(undefined, "vi")).toBe("")
    })

    it("keeps a card in the stop's shape", () => {
        const card = {
            step: { nodeId: "sales.refund-draft", title: "Hoàn tiền", description: "" },
            call: { tool: "nivo.tool.payment.refund.create", account: "SePay · Shop" },
            facts: [{ name: "amountVnd", value: "50000" }],
            text: "Hoàn 50.000đ cho đơn DH-7.",
        }
        expect(APPROVAL_CARD_SHAPE.parse(card)).toEqual(card)
    })

    it("names the call's operation by its tool's worded title (vi/en) for the Thao tac row, and stores it with the card; nothing when none is declared", () => {
        const title = { vi: "Hoàn tiền cho khách", en: "Refund the customer" }
        expect(callLabelOf(title)).toEqual({ label: title })
        expect(callLabelOf(null)).toEqual({})
        expect(callLabelOf(undefined)).toEqual({})
        const card = {
            step: { nodeId: "payment.refund", title: "Hoàn tiền", description: "Hoàn tiền cho khách" },
            call: { tool: "nivo.tool.payment.refund.create", account: "SePay · MB", ...callLabelOf(title) },
            facts: [],
            text: "Hoàn 50.000đ cho đơn DH-7.",
        }
        expect(APPROVAL_CARD_SHAPE.parse(card).call.label).toEqual(title)
    })
})
