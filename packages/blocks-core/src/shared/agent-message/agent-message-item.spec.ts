import { z } from "zod"
import { agentMessageBlock } from "../blocks/agent-message.block"
import { agentMessageItemOf } from "./agent-message-item"
import { agentMessageKindOf, coreAgentMessageKinds, defineAgentMessageKind } from "@nivo-lite/agent-sdk/team-chat"
import { orderSummaryKind } from "./sales-agent-message-kinds"
import { agentMessageKinds } from "./module-agent-message-kinds"

const base = { id: "m-1", kind: "message.text", title: "Reply", payload: { text: "Hello" } }

describe("agentMessageBlock", () => {
    it("is the core.agent-message block over a message and three optional actions", () => {
        expect(agentMessageBlock.id).toBe("core.agent-message")
        expect(agentMessageBlock.slots).toEqual({
            message: { kind: "read", shape: "record", required: true },
            approve: { kind: "action", required: false },
            reject: { kind: "action", required: false },
            reply: { kind: "action", required: false },
        })
        expect(agentMessageBlock.props.safeParse({}).success).toBe(true)
        expect(agentMessageBlock.props.safeParse({ maxLength: 5000 }).success).toBe(false)
    })
})

describe("agentMessageItemOf", () => {
    it("reads a notice of a known kind: no state, not open", () => {
        const item = agentMessageItemOf(base, agentMessageKinds)
        expect(item?.kind?.id).toBe("message.text")
        expect(item?.payload).toEqual({ text: "Hello" })
        expect(item?.intent).toBe("notify")
        expect(item?.state).toBeNull()
        expect(item?.isOpen).toBe(false)
    })

    it("holds an ask or an approval open until its state says otherwise", () => {
        expect(agentMessageItemOf({ ...base, intent: "approve" }, agentMessageKinds)?.isOpen).toBe(true)
        expect(agentMessageItemOf({ ...base, intent: "ask" }, agentMessageKinds)?.state).toBe("waiting")
        expect(agentMessageItemOf({ ...base, intent: "approve", state: "sent" }, agentMessageKinds)?.isOpen).toBe(false)
        expect(agentMessageItemOf({ ...base, intent: "report" }, agentMessageKinds)?.isOpen).toBe(false)
    })

    it("keeps the envelope and the outbound customer content of an approval", () => {
        const item = agentMessageItemOf(
            {
                ...base,
                intent: "approve",
                agent: "Ke toan",
                to: "owner",
                outbound: { to: "Customer A", via: { provider: "zalo_oa", label: "Zalo shop" } },
            },
            agentMessageKinds,
        )
        expect(item?.record.outbound?.via?.label).toBe("Zalo shop")
        expect(item?.record.agent).toBe("Ke toan")
    })

    it("keeps a message of an unknown kind without a kind, so the shell falls back to its summary", () => {
        const item = agentMessageItemOf({ ...base, kind: "document.invoice", summary: "Invoice 17" }, agentMessageKinds)
        expect(item?.kind).toBeUndefined()
        expect(item?.record.summary).toBe("Invoice 17")
    })

    it("treats a payload that does not fit its kind as unknown, and a record that is no message as none", () => {
        expect(agentMessageItemOf({ ...base, payload: { text: 7 } }, agentMessageKinds)?.kind).toBeUndefined()
        expect(agentMessageItemOf({ nothing: true }, agentMessageKinds)).toBeNull()
    })

    it("takes the kinds a module declares", () => {
        const media = defineAgentMessageKind({
            id: "message.media",
            payload: z.object({ url: z.string().max(100), caption: z.string().max(100) }),
            actions: { approve: true, edit: "inline", reject: true },
        })
        const item = agentMessageItemOf({ ...base, kind: "message.media", payload: { url: "u", caption: "c" } }, [
            ...coreAgentMessageKinds,
            media,
        ])
        expect(item?.kind).toBe(media)
        expect(agentMessageKindOf(coreAgentMessageKinds, "message.media")).toBeUndefined()
    })

    it("knows the order summary and the payment received kinds the sales and payment flows register", () => {
        const order = agentMessageItemOf(
            {
                ...base,
                kind: "order.summary",
                payload: {
                    orderNo: "DH-1",
                    lines: [{ name: "Basket", qty: 1 }],
                    amountText: "2.000 VND",
                    customer: "An",
                    address: "25 Nguyen Hue",
                },
            },
            agentMessageKinds,
        )
        expect(order?.kind?.id).toBe("order.summary")
        expect(order?.isOpen).toBe(false)
        const paid = agentMessageItemOf(
            { ...base, kind: "payment.received", payload: { orderNo: "DH-1", amountText: "2.000 VND" } },
            agentMessageKinds,
        )
        expect(paid?.kind?.id).toBe("payment.received")
    })

    it("reads the lines of an order with photo and prices, and an older payload without them", () => {
        const withPhotos = orderSummaryKind.payload.safeParse({
            orderNo: "DH-1",
            lines: [{ name: "Basket", qty: 2, unitText: "1.000 VND", amountText: "2.000 VND", imageUrl: "https://x/y.jpg" }],
            amountText: "2.000 VND",
            customer: "An",
            address: "",
        })
        expect(withPhotos.success).toBe(true)
        const older = orderSummaryKind.payload.safeParse({
            orderNo: "DH-1",
            lines: [{ name: "Basket", qty: 2 }],
            amountText: "",
            customer: "",
            address: "",
        })
        expect(older.success).toBe(true)
    })

    it("lets a payment received message carry the order's items and customer", () => {
        const paid = agentMessageItemOf(
            {
                ...base,
                kind: "payment.received",
                payload: {
                    orderNo: "DH-1",
                    amountText: "2.000 VND",
                    lines: [{ name: "Basket", qty: 1, imageUrl: null }],
                    customer: "An",
                },
            },
            agentMessageKinds,
        )
        expect(paid?.kind?.id).toBe("payment.received")
        expect(paid?.payload).toMatchObject({ customer: "An" })
    })

    it("registers the approval and the run report, so a row stored without a payload still draws as a card", () => {
        const approval = agentMessageItemOf(
            { id: "a-1", kind: "approval.decision", intent: "approve", title: "Needs you", summary: "Sales asks you", payload: {} },
            agentMessageKinds,
        )
        expect(approval?.kind?.id).toBe("approval.decision")
        expect(approval?.kind?.actions).toEqual({ approve: true, edit: "none", reject: true })
        expect(approval?.isOpen).toBe(true)
        const report = agentMessageItemOf(
            { id: "r-1", kind: "report.run", intent: "report", title: "Report", summary: "Done", payload: {} },
            agentMessageKinds,
        )
        expect(report?.kind?.id).toBe("report.run")
        expect(report?.isOpen).toBe(false)
    })
})

describe("the workflow.stopped kind", () => {
    const payload = {
        workflow: { moduleKey: "accounting", key: "reconcile", title: "\u0110\u1ed1i so\u00e1t" },
        step: { key: "match", nodeId: "accounting.match-payment", title: "Kh\u1edbp ti\u1ec1n" },
        runId: "r1",
        leadId: null,
        conversationId: null,
        by: "ai",
        reason: "Kh\u00e1ch chuy\u1ec3n thi\u1ebfu",
        question: "C\u00f3 nh\u1eadn kh\u00f4ng?",
        facts: [{ name: "expectedVnd", value: "100" }],
        suggestions: [{ text: "Nh\u1eadn v\u00e0 ghi n\u1ee3", handledBy: "workflow" }],
        decisions: [],
        repeats: 1,
        firstAt: "2026-11-10T00:00:00.000Z",
        lastAt: "2026-11-10T00:00:00.000Z",
    }
    const base = { id: "m1", kind: "workflow.stopped", intent: "ask", payload }

    it("is a core kind whose payload parses, and offers the suggestions as the envelope's options", () => {
        const item = agentMessageItemOf({ ...base, options: [{ id: "0", label: "Nh\u1eadn v\u00e0 ghi n\u1ee3" }] }, agentMessageKinds)
        expect(item?.kind?.id).toBe("workflow.stopped")
        expect(item?.record.options).toHaveLength(1)
        expect(item?.isOpen).toBe(true)
    })

    it("falls back to the summary when the payload does not fit", () => {
        const item = agentMessageItemOf({ ...base, payload: { ...payload, by: "x" } }, agentMessageKinds)
        expect(item?.kind).toBeUndefined()
    })
})
