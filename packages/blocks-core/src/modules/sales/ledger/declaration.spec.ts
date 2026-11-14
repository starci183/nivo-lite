import { seedSpecProblems } from "@nivo-lite/agent-sdk/module"
import { coreBlocks } from "../../../blocks/core-blocks"
import { salesModule } from "../declaration"
import { platformModule } from "../../platform/declaration"
import { SALES_WORKBENCH_SPEC } from "../specs/sales.workbench"
import { LEDGER_ACTIONS, LEDGER_READS } from "./declaration"

describe("the ledger area of the Sales module (the books of the sale)", () => {
    it("declares the books' reads, the correction, the settlement and the permissions they need, all in the Sales module", () => {
        expect(LEDGER_READS.map((read) => read.id)).toEqual([
            "blocks-core.sales.api.entry.list",
            "blocks-core.sales.api.entry.counts",
            "blocks-core.sales.api.entry.status-counts",
            "blocks-core.sales.api.entry.get",
            "blocks-core.sales.api.entry.figures",
            "blocks-core.sales.api.entry.ledger",
            "blocks-core.sales.api.tax.due-soon",
            "blocks-core.sales.api.entry.weekly",
            "blocks-core.sales.api.transaction.decisions",
            "blocks-core.sales.api.question.owner-queue",
            "blocks-core.sales.api.entry.recent",
            "blocks-core.sales.api.entry.today",
            "blocks-core.sales.api.order.open",
            "blocks-core.sales.api.question.count",
            "blocks-core.sales.api.question.list",
            "blocks-core.sales.api.entry.close-check",
            "blocks-core.sales.api.ledger-settings.get",
        ])
        expect(LEDGER_ACTIONS.map((action) => action.id)).toEqual([
            "sales.adjust",
            "sales.save-ledger-settings",
            "sales.answer-question",
            "sales.resolve-unmatched-payment",
            "sales.decide-owner-item",
            "sales.repost-ledger",
            "sales.settle",
        ])
        const reads = salesModule.reads.map((read) => read.id)
        const actions = salesModule.actions.map((action) => action.id)
        for (const read of LEDGER_READS) expect(reads).toContain(read.id)
        for (const action of LEDGER_ACTIONS) expect(actions).toContain(action.id)
        expect(salesModule.permissions).toEqual(expect.arrayContaining(["sales.view", "sales.manage"]))
    })

    it("draws its views in the Sales workbench, which the installed blocks, reads and actions accept", () => {
        expect(seedSpecProblems(salesModule, coreBlocks, [platformModule])).toEqual([])
        const ids = SALES_WORKBENCH_SPEC.views.map((each) => each.id)
        for (const id of ["today", "overview", "book", "questions", "ledger", "ledger-settings", "data-entries"]) expect(ids).toContain(id)
        const rootOf = (id: string): string | undefined => SALES_WORKBENCH_SPEC.views.find((each) => each.id === id)?.root.block
        expect(rootOf("book")).toBe("sales.book")
        expect(rootOf("ledger")).toBe("sales.ledger")
        expect(rootOf("questions")).toBe("sales.questions")
        expect(Object.keys(SALES_WORKBENCH_SPEC.params ?? {})).toEqual(
            expect.arrayContaining(["ledgerQ", "ledgerSort", "entry", "period", "ledgerStatus", "ledgerPane"]),
        )
        expect(SALES_WORKBENCH_SPEC.aside?.children?.map((node) => [node.block, node.showWhen?.is])).toEqual(
            expect.arrayContaining([
                ["core.stack", ["list", "queue"]],
                ["sales.entry-detail", ["detail"]],
            ]),
        )
    })
})
