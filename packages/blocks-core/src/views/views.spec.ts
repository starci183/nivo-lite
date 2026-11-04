import {
    CONNECTIONS_REGION_PLACEHOLDER,
    DECISION_QUEUE_PLACEHOLDER,
    ITEMS_REGION_PLACEHOLDER,
    KNOWLEDGE_GAPS_PLACEHOLDER,
    KNOWLEDGE_REGION_PLACEHOLDER,
    WHY_PLACEHOLDER,
} from "./placeholders"
import { connectionsRegionView, decisionQueueView, itemsRegionView, knowledgeRegionView, whyView } from "./views"

const ROW = { id: "a", title: "t", description: "d", href: "#" }

describe("the placeholders of the views", () => {
    it("have the shape of the view they stand for, so a skeleton draws what a settled view draws", () => {
        expect(itemsRegionView.safeParse(ITEMS_REGION_PLACEHOLDER).success).toBe(true)
        expect(connectionsRegionView.safeParse(CONNECTIONS_REGION_PLACEHOLDER).success).toBe(true)
        expect(knowledgeRegionView.safeParse(KNOWLEDGE_REGION_PLACEHOLDER).success).toBe(true)
        expect(decisionQueueView.safeParse(DECISION_QUEUE_PLACEHOLDER).success).toBe(true)
        expect(whyView.safeParse(WHY_PLACEHOLDER).success).toBe(true)
    })

    it("list three rows each, with distinct ids", () => {
        const ids = ["placeholder-0", "placeholder-1", "placeholder-2"]
        expect(ITEMS_REGION_PLACEHOLDER.rows.map((row) => row.id)).toEqual(ids)
        expect(KNOWLEDGE_GAPS_PLACEHOLDER.rows.map((row) => row.id)).toEqual(ids)
        expect(DECISION_QUEUE_PLACEHOLDER.rows.map((row) => row.id)).toEqual(ids)
    })
})

describe("the views", () => {
    it("refuse a text past its bound", () => {
        const linkLabel = "x".repeat(2001)
        expect(itemsRegionView.safeParse({ ...ITEMS_REGION_PLACEHOLDER, linkLabel }).success).toBe(false)
    })

    it("refuse a row key past its bound", () => {
        const rows = [{ ...ROW, id: "x".repeat(201) }]
        expect(itemsRegionView.safeParse({ ...ITEMS_REGION_PLACEHOLDER, rows }).success).toBe(false)
    })

    it("refuse a list past its bound", () => {
        const rows = Array.from({ length: 501 }, () => ROW)
        expect(itemsRegionView.safeParse({ ...ITEMS_REGION_PLACEHOLDER, rows }).success).toBe(false)
    })

    it("accept a decision with its commands, trace and badges", () => {
        const command = { id: "approve", label: "Approve", isPending: false, isDanger: true }
        const row = {
            ...DECISION_QUEUE_PLACEHOLDER.rows[0],
            badges: [{ label: "New", tone: "accent" }],
            trace: { line: "Branch", whyHref: null },
            primary: command,
            menu: [command],
        }
        const view = { count: "1", more: { label: "2 more", href: "/queue" }, rows: [row] }
        expect(decisionQueueView.safeParse(view).success).toBe(true)
    })

    it("refuse a badge tone the Grammar does not have", () => {
        const row = { ...DECISION_QUEUE_PLACEHOLDER.rows[0], badges: [{ label: "New", tone: "pink" }] }
        expect(decisionQueueView.safeParse({ count: null, more: null, rows: [row] }).success).toBe(false)
    })

    it("accept a why pane with an approver", () => {
        const approver = {
            name: "Mai",
            seed: "m",
            limit: "10",
            onTimeout: "ask",
            usedPercent: 40,
            valueText: "4 of 10",
        }
        expect(whyView.safeParse({ ...WHY_PLACEHOLDER, approver }).success).toBe(true)
    })
})
