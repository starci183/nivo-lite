import { z } from "zod"
import {
    approvalDecisionCard,
    approvalDecisionKind,
    coreAgentMessageKinds,
    defineAgentMessageKind,
    packageKindRefusalOf,
    reportFactsPayload,
    workflowStoppedKind,
    workflowStoppedPayload,
} from "./index"

/** A card the engine builds before a write under `ask`. */
const CARD = {
    step: { nodeId: "sales.order-confirm", title: "X\u00e1c nh\u1eadn \u0111\u01a1n", description: "G\u1eedi x\u00e1c nh\u1eadn \u0111\u01a1n cho kh\u00e1ch" },
    call: { tool: "zalo.message.send", account: "Zalo OA \u00b7 Shop Hoa" },
    facts: [{ name: "Kh\u00e1ch", value: "Lan" }],
    text: "G\u1eedi x\u00e1c nh\u1eadn \u0111\u01a1n 2 b\u00f3 hoa cho Lan?",
    preview: { kind: "sales.order-summary", payload: { total: 500000 } },
}

/** A stopped workflow as the engine posts it. */
const STOPPED = {
    workflow: { moduleKey: "sales", key: "order", title: "\u0110\u01a1n" },
    step: { key: "confirm", nodeId: "sales.order-confirm", title: "X\u00e1c nh\u1eadn" },
    runId: "run-1",
    leadId: null,
    conversationId: null,
    by: "ai",
    reason: "Thi\u1ebfu \u0111\u1ecba ch\u1ec9",
    question: null,
    facts: [],
    suggestions: [],
    decisions: [],
    repeats: 1,
    firstAt: "2026-11-13T00:00:00.000Z",
    lastAt: "2026-11-13T00:00:00.000Z",
}

describe("team chat contracts", () => {
    it("the core kinds have distinct ids and the stopped card is read only", () => {
        const ids = coreAgentMessageKinds.map((kind) => kind.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(workflowStoppedKind.actions).toEqual({ approve: false, edit: "none", reject: false })
    })

    it("registers the engine's brain.change, background.stopped and chain.stopped as core kinds", () => {
        const ids = coreAgentMessageKinds.map((kind) => kind.id)
        expect(ids).toEqual(expect.arrayContaining(["brain.change", "background.stopped", "chain.stopped"]))
    })

    it("a report with facts keeps a technical fact apart and refuses a value that is too long", () => {
        expect(reportFactsPayload.safeParse({ text: "D\u1eebng", facts: [{ name: "M\u00e3", value: "E1", technical: true }] }).success).toBe(true)
        expect(reportFactsPayload.safeParse({ text: "D\u1eebng", facts: [{ name: "M\u00e3", value: "x".repeat(401) }] }).success).toBe(false)
    })
})

describe("approval.decision", () => {
    it("parses the engine's card: step, call, facts, text and a preview", () => {
        expect(approvalDecisionKind.payload.parse(CARD)).toEqual(CARD)
        expect(approvalDecisionCard.parse(CARD)).toEqual(CARD)
    })

    it("still parses a row stored before the card: only text, or only a connection link, or nothing", () => {
        expect(approvalDecisionKind.payload.safeParse({ text: "Duy\u1ec7t g\u1eedi?" }).success).toBe(true)
        expect(approvalDecisionKind.payload.safeParse({ connectionHref: "/connections/zalo" }).success).toBe(true)
        expect(approvalDecisionKind.payload.safeParse({}).success).toBe(true)
    })

    it("the engine's card needs its step, call, facts and text; the preview is optional", () => {
        const bare = { step: CARD.step, call: CARD.call, facts: CARD.facts, text: CARD.text }
        expect(approvalDecisionCard.safeParse(bare).success).toBe(true)
        expect(approvalDecisionCard.safeParse({ text: "Duy\u1ec7t g\u1eedi?" }).success).toBe(false)
        expect(approvalDecisionCard.safeParse({ ...CARD, call: { tool: "zalo.message.send" } }).success).toBe(false)
    })

    it("refuses a preview without a kind", () => {
        expect(approvalDecisionKind.payload.safeParse({ ...CARD, preview: { kind: "", payload: {} } }).success).toBe(false)
    })
})

describe("workflow.stopped preview", () => {
    it("carries an optional package preview", () => {
        expect(workflowStoppedPayload.safeParse(STOPPED).success).toBe(true)
        expect(workflowStoppedPayload.safeParse({ ...STOPPED, preview: { kind: "sales.order-summary", payload: {} } }).success).toBe(true)
        expect(workflowStoppedPayload.safeParse({ ...STOPPED, preview: { payload: {} } }).success).toBe(false)
    })
})

describe("packageKindRefusalOf", () => {
    const kindOf = (id: string, approve: boolean, reject: boolean) =>
        defineAgentMessageKind({ id, payload: z.object({}), actions: { approve, edit: "none", reject } })

    it("lets a read-only package kind register", () => {
        expect(packageKindRefusalOf(kindOf("sales.order-summary", false, false))).toBeNull()
    })

    it("refuses a package kind that declares approve or reject", () => {
        expect(packageKindRefusalOf(kindOf("sales.order-confirm", true, false))).toBe("verdict_actions")
        expect(packageKindRefusalOf(kindOf("sales.order-drop", false, true))).toBe("verdict_actions")
    })

    it("refuses a package kind that takes a core kind's id", () => {
        expect(packageKindRefusalOf(kindOf("chain.stopped", false, false))).toBe("core_kind_id")
    })
})
