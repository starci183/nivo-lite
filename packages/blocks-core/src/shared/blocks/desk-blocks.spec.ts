import { agentFlowsBlock } from "./agent-flows.block"
import { dataSetPathOf, dataSetViewOf, dataSetsBlock } from "./data-sets.block"
import { decisionQueueBlock } from "./decision-queue.block"
import { listCardBlock } from "./list-card.block"
import { reachCardBlock } from "./reach-card.block"
import {
    agentFlowsFixtureProps,
    agentFlowsFixtures,
    dataSetsFixtureProps,
    reachCardFixtureProps,
    reachCardFixtures,
} from "../fixtures/desk-blocks.fixtures"
import {
    DESK_FLOWS_VIEW,
    DESK_REACH_VIEW,
    DESK_WAITING_THREE,
    DESK_WAITING_VIEW,
} from "../platform/fixtures/agent-desk.fixtures"
import { declaredQueue, onePrimaryQueue } from "../rows/decision-commands"
import { decisionQueueView } from "../views/views"
import { deskFlowsView, filledText, reachRowsOf, reachView, setCountIn, setCountOf } from "../rows/desk-views"
import { figureTextOf, UNSTATED_TALLY } from "../rows/figure-format"
import { formatValue } from "../rows/cell-format"

const WORD = { key: "word" }

describe("the generic blocks of the agent's desk", () => {
    it("take the props the desk template gives them", () => {
        expect(agentFlowsBlock.props.safeParse(agentFlowsFixtureProps).success).toBe(true)
        expect(reachCardBlock.props.safeParse(reachCardFixtureProps).success).toBe(true)
        expect(dataSetsBlock.props.safeParse(dataSetsFixtureProps).success).toBe(true)
    })

    it("bind one read each: the flows and the reach required, the counts of the data sets optional", () => {
        expect(agentFlowsBlock.slots).toEqual({ flows: { kind: "read", shape: "record", required: true } })
        expect(reachCardBlock.slots).toEqual({ reach: { kind: "read", shape: "record", required: true } })
        expect(dataSetsBlock.slots).toEqual({ counts: { kind: "read", shape: "record", required: false } })
    })

    it("refuse a data set id that is no URL segment and two rows of one set", () => {
        const item = { set: "Bad Set", label: WORD }
        expect(dataSetsBlock.props.safeParse({ label: WORD, openLabel: WORD, items: [item] }).success).toBe(false)
        const twice = [
            { set: "a", label: WORD },
            { set: "a", label: WORD },
        ]
        expect(dataSetsBlock.props.safeParse({ label: WORD, openLabel: WORD, items: twice }).success).toBe(false)
        expect(dataSetsBlock.props.safeParse({ label: WORD, openLabel: WORD, items: [] }).success).toBe(true)
    })

    it("open a set on its own page, the view data-<set> of the module's spec, never a tab of the desk", () => {
        expect(dataSetPathOf("tickets")).toBe("./data/tickets")
        expect(dataSetViewOf("tickets")).toBe("data-tickets")
    })

    it("draw no count where the read holds none, never 0", () => {
        expect(setCountOf(12)).toBe(12)
        expect(setCountOf(0)).toBe(0)
        expect(setCountOf(null)).toBeNull()
        expect(setCountOf(undefined)).toBeNull()
        expect(setCountOf([{ state: "open", count: 3 }])).toBeNull()
    })

    it("count a set from the counts as data: a number at a path, or a sum over rows narrowed by a key", () => {
        const counts = {
            invoices: 12,
            renewals: [
                { state: "paid", count: 2 },
                { state: "awaiting_payment", count: 3 },
                { state: "done", count: 9 },
            ],
        }
        expect(setCountIn(counts, { countPath: "invoices" })).toBe(12)
        expect(
            setCountIn(counts, {
                countRows: { path: "renewals", value: "count", by: "state", keys: ["paid", "awaiting_payment"] },
            }),
        ).toBe(5)
        expect(setCountIn(counts, { countRows: { path: "renewals", value: "count" } })).toBe(14)
        expect(setCountIn(counts, { countRows: { path: "tickets", value: "count" } })).toBeNull()
        expect(setCountIn(counts, {})).toBeNull()
        const both = { set: "a", label: WORD, countPath: "x", countRows: { path: "y", value: "count" } }
        expect(dataSetsBlock.props.safeParse({ label: WORD, openLabel: WORD, items: [both] }).success).toBe(false)
    })

    it("draw a tally nobody stated as a dash, never 0; a money amount the read leaves null as an empty cell", () => {
        const context = { locale: "vi", currency: "VND" }
        expect(figureTextOf(null, "tally", context)).toBe(UNSTATED_TALLY)
        expect(figureTextOf(41, "tally", context)).toBe("41")
        expect(formatValue(null, "money", context)).toBe("")
    })

    it("read the flows as the canvas's own card views of the installed graph", () => {
        expect(deskFlowsView.safeParse(DESK_FLOWS_VIEW).success).toBe(true)
        expect(agentFlowsFixtures.ready).toEqual({ items: DESK_FLOWS_VIEW })
        expect(filledText("{workflows} workflow, {steps} b\u01b0\u1edbc", { workflows: "1", steps: "3" })).toBe(
            "1 workflow, 3 b\u01b0\u1edbc",
        )
    })

    it("lay the reach out as the accounts, then each mode that holds operations", () => {
        expect(reachView.safeParse(DESK_REACH_VIEW).success).toBe(true)
        expect(reachRowsOf(DESK_REACH_VIEW).map((row) => [row.id, row.chip])).toEqual([
            ["account:conn-1", "connected"],
            ["mode:auto", "auto"],
            ["mode:ask", "ask"],
        ])
        expect(reachRowsOf({ accounts: [], auto: [], ask: ["x"], none: [] }).map((row) => row.id)).toEqual(["mode:ask"])
        expect(reachCardFixtures.loading).toEqual({ isLoading: true })
    })

    it("give the run list a head link and the queue its words for a stop answered elsewhere", () => {
        const list = {
            label: WORD,
            empty: WORD,
            idPath: "id",
            titlePath: "subject",
            selectParam: "run",
            search: false,
            headLink: { label: WORD, path: "./work" },
        }
        expect(listCardBlock.props.safeParse(list).success).toBe(true)
        const queue = {
            surface: "card",
            label: WORD,
            emptyTitle: WORD,
            emptyBody: WORD,
            seeWhy: WORD,
            moreMenu: WORD,
            elsewhere: WORD,
        }
        expect(decisionQueueBlock.props.safeParse(queue).success).toBe(true)
        expect(decisionQueueView.safeParse(DESK_WAITING_VIEW).success).toBe(true)
    })

    it("draws ONE filled primary per queue: the oldest approval's approve; every other row's commands neutral", () => {
        const commands = [
            { id: "approve", label: WORD, intent: "commit" as const },
            { id: "decline", label: WORD, intent: "neutral" as const },
        ]
        const queue = onePrimaryQueue(declaredQueue(DESK_WAITING_THREE, commands, undefined, () => "x"))
        expect(queue.rows.map((row) => row.askedAt)).toEqual([
            "2026-11-12T02:12:00.000Z",
            "2026-11-12T02:40:00.000Z",
            "2026-11-12T03:05:00.000Z",
        ])
        expect(queue.rows.map((row) => [row.primary?.intent, row.alternative?.intent])).toEqual([
            ["commit", "neutral"],
            ["neutral", "neutral"],
            ["neutral", "neutral"],
        ])
        const two = onePrimaryQueue(declaredQueue(DESK_WAITING_VIEW, commands, undefined, () => "x"))
        expect(two.rows.map((row) => row.primary?.intent ?? null)).toEqual([null, "commit"])
    })
})
