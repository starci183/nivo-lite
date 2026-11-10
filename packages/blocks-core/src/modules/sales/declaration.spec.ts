import { seedSpecProblems } from "@nivo-lite/agent-sdk/module"
import type { SpecNode } from "@nivo-lite/agent-sdk/spec"
import { coreBlocks } from "../../blocks/core-blocks"
import { salesBlocks } from "../../blocks/sales/sales-blocks"
import { resumeRunAction } from "../platform/actions/resume-run.action"
import {
    ATTENTION_COUNT_KEY,
    ATTENTION_KINDS,
    ATTENTION_KIND_VIEWS,
    PARKED_REASON_KEYS,
    PARKED_STEP_KEYS,
} from "../../rules/sales/attention-list"
import { FIGURE_HINT_KEYS } from "../../rules/sales/figures"
import { PIPELINE_WORD_KEYS, stageKeyOf } from "../../rules/sales/pipeline"
import { LEAD_STAGES } from "../../rules/sales/stage"
import { platformModule } from "../platform/declaration"
import { salesModule } from "./declaration"
import { SALES_FIXTURES } from "./fixtures/sales.fixtures"
import { SALES_MESSAGES } from "./sales-messages"
import { refusedWith } from "./refusals"
import type { SalesRefusal } from "./refusals"
import { SALES_WORKBENCH_SPEC } from "./specs/sales.workbench"

const nodesOf = (node: SpecNode): ReadonlyArray<SpecNode> => [node, ...(node.children ?? []).flatMap(nodesOf)]

const allNodes: ReadonlyArray<SpecNode> = [
    ...SALES_WORKBENCH_SPEC.views.flatMap((view) => nodesOf(view.root)),
    ...(SALES_WORKBENCH_SPEC.aside === undefined ? [] : nodesOf(SALES_WORKBENCH_SPEC.aside)),
]

/** Every message key a text names, found in the JSON of the spec. */
const keysIn = (value: unknown): ReadonlyArray<string> => {
    if (Array.isArray(value)) return value.flatMap(keysIn)
    if (typeof value !== "object" || value === null) return []
    return Object.entries(value).flatMap(([name, item]) =>
        name === "key" && typeof item === "string" ? [item] : keysIn(item),
    )
}

describe("the Sales module declaration", () => {
    it("is judged sound against the installed core blocks, its own reads, actions and permissions", () => {
        expect(seedSpecProblems(salesModule, coreBlocks, [platformModule])).toEqual([])
    })

    it("declares the reads and actions of the Sales workbench under its own key", () => {
        expect(salesModule.key).toBe("sales")
        expect(salesModule.reads.map((read) => read.id)).toEqual([
            "sales.leads",
            "sales.lead-counts",
            "sales.lead",
            "sales.orders",
            "sales.order-counts",
            "sales.order",
            "sales.orders-waiting",
            "sales.settings",
            "sales.figures",
            "sales.attention",
            "sales.decisions",
            "sales.awaiting-reply",
        ])
        expect(salesModule.actions.map((action) => action.id)).toEqual([
            "sales.move-stage",
            "sales.confirm-order",
            "sales.cancel-order",
            "sales.save-settings",
            "sales.decide",
            "sales.respond",
            "sales.follow",
            "sales.reply",
        ])
    })

    it("declares the three permissions and nothing outside them is asked", () => {
        expect(salesModule.permissions).toEqual(["sales.view", "sales.manage", "sales.approve"])
        expect(salesModule.reads.every((read) => read.permission === "sales.view")).toBe(true)
        expect(salesModule.actions.filter((action) => action.permission !== "sales.manage").map((a) => a.id)).toEqual([
            "sales.decide",
        ])
        expect(salesModule.actions.find((action) => action.id === "sales.decide")?.permission).toBe("sales.approve")
    })

    it("offers confirm and cancel on the order detail only as the read's flags say", () => {
        const detail = allNodes.find((node) => node.id === "order-detail")
        expect(detail?.block).toBe("core.detail")
        expect(detail?.props).toMatchObject({ primaryWhen: "canConfirm", secondaryWhen: "canCancel" })
        const strays = allNodes.filter((node) => node.id !== "order-detail" && "primaryWhen" in (node.props ?? {}))
        expect(strays).toEqual([])
    })

    it("seeds one spec with the attention, customers, orders and settings views", () => {
        expect(salesModule.specs).toEqual([SALES_WORKBENCH_SPEC])
        expect(SALES_WORKBENCH_SPEC.views.map((view) => view.id)).toEqual([
            "attention",
            "pipeline",
            "orders",
            "settings",
        ])
    })

    it("has no tool, so nothing leaves the system from a transactional action", () => {
        expect(salesModule.tools).toBeUndefined()
    })

    it("declares the payment reminder timings as policy values of the sales agent, in hours", () => {
        expect(salesModule.agent?.policy.limits).toMatchObject({ paymentReminderHours: 2, paymentStaleHours: 24 })
    })
})

describe("the fixtures of the Sales module", () => {
    const bound = [
        ...new Set(
            allNodes.flatMap((node) => Object.values(node.bind ?? {}).flatMap((b) => ("read" in b ? [b.read] : []))),
        ),
    ]

    it("hold every read the seed spec binds, and every read of the module", () => {
        const platformReads = new Set<string>(platformModule.reads.map((read) => read.id))
        expect(bound.filter((id) => !(id in SALES_FIXTURES.reads) && !platformReads.has(id))).toEqual([])
        expect(salesModule.reads.map((read) => read.id).sort()).toEqual(Object.keys(SALES_FIXTURES.reads).sort())
    })

    it("hold an answer for every action of the module", () => {
        expect(salesModule.actions.map((action) => action.id).sort()).toEqual(
            Object.keys(SALES_FIXTURES.actions).sort(),
        )
    })

    it.each(Object.entries(SALES_FIXTURES.reads))("%s has a ready answer and an empty one", (_id, fixture) => {
        expect(fixture.ready).toBeDefined()
        expect("empty" in fixture).toBe(true)
    })

    it("has a waiting-for-owner order and a waiting list with that order", () => {
        expect(SALES_FIXTURES.reads["sales.order"]?.waiting).toMatchObject({ approval: "owner", status: "draft" })
        expect(SALES_FIXTURES.reads["sales.orders-waiting"]?.ready).toMatchObject({ count: "1" })
    })
})

describe("the messages of the Sales module", () => {
    const refusals: ReadonlyArray<SalesRefusal> = [
        "missing",
        "same_stage",
        "stage_not_allowed",
        "reopen_needs_owner",
        "reason_required",
        "order_not_confirmable",
        "order_not_cancellable",
        "order_paid",
        "order_invoiced",
        "order_has_payment",
        "order_has_invoice",
        "settings_not_saved",
        "not_awaiting",
        "phone_required",
        "phone_taken",
    ]
    const used = [
        ...new Set([
            ...keysIn(SALES_WORKBENCH_SPEC),
            ...salesModule.actions.flatMap((action) => keysIn(action.label)),
            ...refusals.flatMap((reason) => keysIn(refusedWith(reason))),
            ...salesBlocks.flatMap((block) => keysIn(block.title)),
            ATTENTION_COUNT_KEY,
            "attention_empty_hint",
            FIGURE_HINT_KEYS.open,
            FIGURE_HINT_KEYS.proposal,
            FIGURE_HINT_KEYS.closed,
            FIGURE_HINT_KEYS.conversion,
            ...ATTENTION_KINDS.flatMap((kind) => [
                ATTENTION_KIND_VIEWS[kind].chipKey,
                ATTENTION_KIND_VIEWS[kind].commandKey,
            ]),
            ...[resumeRunAction].flatMap((action) => keysIn(action.label)),
            ...PARKED_STEP_KEYS.values(),
            ...PARKED_REASON_KEYS.values(),
            ...Object.values(PIPELINE_WORD_KEYS),
            ...LEAD_STAGES.map(stageKeyOf),
            "refusal_conflict",
            "refusal_order_waits_owner",
        ]),
    ].sort()

    it("hold the same keys in both product languages", () => {
        expect(Object.keys(SALES_MESSAGES.en).sort()).toEqual(Object.keys(SALES_MESSAGES.vi).sort())
    })

    it("hold every key the spec, the actions and the refusals name, and nothing else", () => {
        expect(Object.keys(SALES_MESSAGES.vi).sort()).toEqual(used)
    })

    it("have no blank text", () => {
        for (const text of [...Object.values(SALES_MESSAGES.vi), ...Object.values(SALES_MESSAGES.en)])
            expect(text.trim()).not.toBe("")
    })
})
