import { approvalDecisionKind, messageTextKind, type AgentMessageKind, type ApprovalDecisionPayload } from "@nivo-lite/agent-sdk/team-chat"
import { z } from "zod"
import { approvalRowsOf, previewViewOf } from "./agent-message-approval"

const words = { step: "Step", account: "Account", tool: "Operation", node: "Step id", locale: "en" as const }

const draftKind: AgentMessageKind = {
    id: "mail.draft",
    payload: z.object({ subject: z.string().max(200) }),
    actions: { approve: false, edit: "none", reject: false },
}

describe("approvalRowsOf", () => {
    it("lists the step (title and description), the account and the worded facts; the raw ones go to the technical rows", () => {
        const rows = approvalRowsOf(
            {
                text: "Send quote",
                step: { nodeId: "sales.quote", title: "Send quote", description: "Send the quote to the customer" },
                call: { tool: "nivo.tool.customer.message.send", account: "Zalo OA - Flower shop" },
                facts: [
                    { name: "Amount", value: "350,000 VND" },
                    { name: "Error code", value: "E_RAW", technical: true },
                ],
            },
            words,
        )
        expect(rows.worded.map((entry) => entry.value)).toEqual(["Send quote · Send the quote to the customer", "Zalo OA - Flower shop", "350,000 VND"])
        expect(rows.technical.map((entry) => entry.value)).toEqual(["nivo.tool.customer.message.send", "sales.quote", "E_RAW"])
    })

    it("draws the operation row after the step, with the account in the same row, when the call carries a worded label", () => {
        const payload = {
            step: { nodeId: "n", title: "Refund", description: "" },
            call: { tool: "nivo.tool.payos.link.cancel", account: "payOS Shop", label: { vi: "Cancel link (vi)", en: "Cancel payment link" } },
            facts: [{ name: "Amount", value: "450,000 VND" }],
        }
        const en = approvalRowsOf(payload, words)
        expect(en.worded.map((entry) => [entry.name, entry.value])).toEqual([
            ["Step", "Refund"],
            ["Operation", "Cancel payment link · payOS Shop"],
            ["Amount", "450,000 VND"],
        ])
        const vi = approvalRowsOf(payload, { ...words, locale: "vi" })
        expect(vi.worded[1]?.value).toBe("Cancel link (vi) · payOS Shop")
        expect(en.technical.map((entry) => entry.value)).toEqual(["nivo.tool.payos.link.cancel", "n"])
    })

    it("draws the label alone when the call has no account", () => {
        const rows = approvalRowsOf({ call: { tool: "t", account: null, label: { vi: "a", en: "Send" } } }, words)
        expect(rows.worded.map((entry) => entry.value)).toEqual(["Send"])
    })

    it("draws no operation row, and keeps the account row, when the label is absent or malformed", () => {
        const call = { tool: "t", account: "Zalo" }
        for (const label of [undefined, "Send", { vi: "x" }, { vi: "x", en: 3 }, { vi: "x", en: "  " }, null]) {
            // A row as the store gives it back (JSON), so a label of any shape reaches the reader.
            const stored: ApprovalDecisionPayload = JSON.parse(JSON.stringify({ call: { ...call, label } }))
            const rows = approvalRowsOf(stored, words)
            expect(rows.worded.map((entry) => entry.name)).toEqual(["Account"])
        }
    })

    it("skips blank members and gives nothing for an older row", () => {
        expect(approvalRowsOf({ text: "x" }, words)).toEqual({ worded: [], technical: [] })
        const rows = approvalRowsOf(
            { step: { nodeId: "", title: " ", description: " " }, call: { tool: "", account: null } },
            words,
        )
        expect(rows).toEqual({ worded: [], technical: [] })
    })
})

describe("previewViewOf", () => {
    const views = [{ kind: draftKind }, { kind: messageTextKind }, { kind: approvalDecisionKind }]

    it("finds the view of a registered package kind and hands over the parsed payload", () => {
        const found = previewViewOf({ kind: "mail.draft", payload: { subject: "Hi" } }, views)
        expect(found?.view.kind.id).toBe("mail.draft")
        expect(found?.payload).toEqual({ subject: "Hi" })
    })

    it("draws nothing for no preview, an unknown kind, a core kind or a payload that fails its schema", () => {
        expect(previewViewOf(undefined, views)).toBeNull()
        expect(previewViewOf({ kind: "no.such", payload: {} }, views)).toBeNull()
        expect(previewViewOf({ kind: "message.text", payload: { text: "x" } }, views)).toBeNull()
        expect(previewViewOf({ kind: "mail.draft", payload: { subject: 3 } }, views)).toBeNull()
    })
})
