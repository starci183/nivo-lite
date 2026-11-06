import { bookFixtureProps, bookFixtures } from "../../fixtures/accounting/book.fixtures"
import { entryDetailFixtureProps, entryDetailFixtures } from "../../fixtures/accounting/entry-detail.fixtures"
import { questionsFixtureProps, questionsFixtures } from "../../fixtures/accounting/questions.fixtures"
import { bookRecords } from "../../rules/accounting/book-view"
import { entryRecord } from "../../rules/accounting/entry-stages"
import { questionsRecord } from "../../rules/accounting/question-rows"
import { accountingBlocks } from "./accounting-blocks"
import { accountingBookBlock } from "./book.block"
import { accountingEntryDetailBlock } from "./entry-detail.block"
import { accountingQuestionsBlock } from "./questions.block"

const itemsOf = (slot: object): unknown => ("items" in slot ? slot.items : undefined)

describe("accountingBlocks", () => {
    it("lists the three blocks of the module under the accounting namespace, with no children", () => {
        expect(accountingBlocks.map((block) => block.id)).toEqual([
            "accounting.book",
            "accounting.entry-detail",
            "accounting.questions",
        ])
        expect(accountingBlocks.every((block) => block.children === false)).toBe(true)
    })

    it("takes the props of its fixtures and names the params its props read", () => {
        expect(accountingBookBlock.props.safeParse(bookFixtureProps).success).toBe(true)
        expect(accountingEntryDetailBlock.props.safeParse(entryDetailFixtureProps).success).toBe(true)
        expect(accountingQuestionsBlock.props.safeParse(questionsFixtureProps).success).toBe(true)
        expect(accountingBookBlock.params).toEqual(["searchParam", "filterParam", "selectParam", "periodParam"])
        expect(accountingEntryDetailBlock.params).toEqual(["closeParam"])
    })

    it("refuses a param name that is not one", () => {
        expect(accountingBookBlock.props.safeParse({ ...bookFixtureProps, searchParam: "not a param" }).success).toBe(
            false,
        )
    })

    it("binds the reads and actions its renderer needs", () => {
        expect(accountingBookBlock.slots).toEqual({
            rows: { kind: "read", shape: "list", required: true },
            counts: { kind: "read", shape: "record", required: true },
        })
        expect(accountingEntryDetailBlock.slots).toEqual({
            record: { kind: "read", shape: "record", required: true },
            adjust: { kind: "action", required: false },
        })
        expect(accountingQuestionsBlock.slots).toEqual({
            questions: { kind: "read", shape: "record", required: true },
            answer: { kind: "action", required: true },
        })
    })

    it("has fixtures that its views accept in the ready states", () => {
        expect(bookRecords.safeParse(itemsOf(bookFixtures.rows.ready)).success).toBe(true)
        expect(entryRecord.safeParse(itemsOf(entryDetailFixtures.ready)).success).toBe(true)
        expect(entryRecord.safeParse(itemsOf(entryDetailFixtures.waiting)).success).toBe(true)
        expect(questionsRecord.safeParse(itemsOf(questionsFixtures.ready)).success).toBe(true)
        expect(questionsRecord.safeParse(itemsOf(questionsFixtures.waiting)).success).toBe(true)
    })

    it("has a fixture for every other status of each read", () => {
        const states = ["empty", "error", "loading", "forbidden"] as const
        expect(states.every((state) => state in bookFixtures.rows && state in bookFixtures.counts)).toBe(true)
        expect(states.every((state) => state in entryDetailFixtures && state in questionsFixtures)).toBe(true)
    })
})
