import { seedSpecProblems } from "@nivo-lite/agent-sdk/module"
import { coreBlocks } from "../../blocks/core-blocks"
import { accountingModule, paymentModule } from "./declaration"
import { accountingSpecDocument } from "./specs/accounting.spec-document"

describe("accounting module", () => {
    it("declares the books' reads, the correction, and the permissions they need", () => {
        expect(accountingModule.key).toBe("accounting")
        expect(accountingModule.reads.map((read) => read.id)).toEqual([
            "accounting.entries",
            "accounting.entry-counts",
            "accounting.status-counts",
            "accounting.entry",
            "accounting.figures",
            "accounting.weekly",
            "accounting.decisions",
            "accounting.question-count",
            "accounting.questions",
            "accounting.close-check",
            "accounting.settings",
        ])
        expect(accountingModule.actions.map((action) => action.id)).toEqual([
            "accounting.adjust",
            "accounting.save-settings",
            "accounting.answer-question",
        ])
        expect(accountingModule.permissions).toEqual(["accounting.view", "accounting.manage"])
    })

    it("declares payment.settle in its own module, with the words of Accounting", () => {
        expect(paymentModule.key).toBe("payment")
        expect(paymentModule.actions.map((action) => action.id)).toEqual(["payment.settle"])
        expect(paymentModule.reads).toEqual([])
        expect(paymentModule.namespace).toBe(accountingModule.namespace)
    })

    it("has a seed spec that the installed blocks, reads and actions accept", () => {
        expect(accountingModule.specs).toEqual([accountingSpecDocument])
        expect(seedSpecProblems(accountingModule, coreBlocks)).toEqual([])
        expect(seedSpecProblems(paymentModule, coreBlocks)).toEqual([])
    })

    it("draws figures on the overview only, the queue in the aside, a book view bound to the list, its counts and the detail, and a settings form", () => {
        const view = accountingSpecDocument.views.find((each) => each.id === "book")
        expect(accountingSpecDocument.views.map((each) => each.id)).toEqual([
            "overview",
            "book",
            "questions",
            "ledger",
            "settings",
        ])
        expect(view?.id).toBe("book")
        const placed = (id: string): ReadonlyArray<string> =>
            (accountingSpecDocument.views.find((each) => each.id === id)?.root.children ?? []).map((node) => node.block)
        expect(placed("book")).toEqual(["accounting.book", "accounting.entry-detail"])
        expect(placed("ledger")).toEqual(["accounting.book", "accounting.entry-detail"])
        expect(accountingSpecDocument.views.find((each) => each.id === "questions")?.root.block).toBe(
            "accounting.questions",
        )
        expect(Object.keys(accountingSpecDocument.params ?? {})).toEqual([
            "q",
            "sort",
            "selected",
            "period",
            "status",
            "pane",
        ])
        expect(accountingSpecDocument.head).toBeUndefined()
        expect(accountingSpecDocument.views[0]?.root.children?.map((node) => node.id)).toEqual([
            "figures",
            "weekly",
            "ageing",
        ])
    })
})
