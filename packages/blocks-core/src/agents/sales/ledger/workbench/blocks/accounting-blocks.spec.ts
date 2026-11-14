import {
    ageingFixtureProps,
    dueSoonFixtureProps,
    dueSoonFixtures,
    ledgerFixtureProps,
    ledgerFixtures,
    periodFiguresFixtureProps,
    periodFiguresFixtures,
    weeklyFixtureProps,
    weeklyFixtures,
} from "../fixtures/overview.fixtures"
import { bookFixtureProps, bookFixtures } from "../fixtures/book.fixtures"
import { entryDetailFixtureProps, entryDetailFixtures } from "../fixtures/entry-detail.fixtures"
import { questionsFixtureProps, questionsFixtures } from "../fixtures/questions.fixtures"
import { bookRecords } from "../../rules/book-view"
import { ledgerRecord } from "../../rules/ledger-view"
import { dueRecord, figuresRecord } from "../../rules/overview-view"
import { weeklyRecord } from "../../rules/weekly-view"
import { entryRecord } from "../../rules/entry-stages"
import { questionsRecord } from "../../rules/question-rows"
import { accountingBlocks } from "./accounting-blocks"
import { accountingAgeingBlock } from "./ageing.block"
import { accountingBookBlock } from "./book.block"
import { accountingDueSoonBlock } from "./due-soon.block"
import { accountingLedgerBlock } from "./ledger.block"
import { accountingPeriodFiguresBlock } from "./period-figures.block"
import { accountingEntryDetailBlock } from "./entry-detail.block"
import { accountingQuestionsBlock } from "./questions.block"
import { accountingWeeklyBlock } from "./weekly.block"

const itemsOf = (slot: object): unknown => ("items" in slot ? slot.items : undefined)

describe("accountingBlocks", () => {
    it("lists the eight blocks of the module under the accounting namespace, with no children", () => {
        expect(accountingBlocks.map((block) => block.id)).toEqual([
            "sales.period-figures",
            "sales.due-soon",
            "sales.weekly",
            "sales.ageing",
            "sales.book",
            "sales.ledger",
            "sales.entry-detail",
            "sales.questions",
        ])
        expect(accountingBlocks.every((block) => block.children === false)).toBe(true)
    })

    it("takes the props of its fixtures and names the params its props read", () => {
        expect(accountingBookBlock.props.safeParse(bookFixtureProps).success).toBe(true)
        expect(accountingEntryDetailBlock.props.safeParse(entryDetailFixtureProps).success).toBe(true)
        expect(accountingQuestionsBlock.props.safeParse(questionsFixtureProps).success).toBe(true)
        expect(accountingPeriodFiguresBlock.props.safeParse(periodFiguresFixtureProps).success).toBe(true)
        expect(accountingDueSoonBlock.props.safeParse(dueSoonFixtureProps).success).toBe(true)
        expect(accountingLedgerBlock.props.safeParse(ledgerFixtureProps).success).toBe(true)
        expect(accountingLedgerBlock.params).toEqual(["periodParam"])
        expect(accountingWeeklyBlock.props.safeParse(weeklyFixtureProps).success).toBe(true)
        expect(accountingWeeklyBlock.params).toEqual(["periodParam"])
        expect(accountingAgeingBlock.props.safeParse(ageingFixtureProps).success).toBe(true)
        expect(accountingBookBlock.params).toEqual([
            "searchParam",
            "filterParam",
            "selectParam",
            "periodParam",
            "paneParam",
        ])
        expect(accountingEntryDetailBlock.params).toEqual(["closeParam", "paneParam"])
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
            repost: { kind: "action", required: false },
        })
        expect(accountingQuestionsBlock.slots).toEqual({
            questions: { kind: "read", shape: "record", required: true },
            answer: { kind: "action", required: true },
        })
    })

    it("binds one read each in the overview, the due list and the cash book", () => {
        const record = { kind: "read", shape: "record", required: true }
        expect(accountingPeriodFiguresBlock.slots).toEqual({ figures: record })
        expect(accountingDueSoonBlock.slots).toEqual({ due: record })
        expect(accountingLedgerBlock.slots).toEqual({ ledger: record })
        expect(accountingWeeklyBlock.slots).toEqual({ weekly: record })
        expect(accountingAgeingBlock.slots).toEqual({ figures: record })
    })

    it("has fixtures that its views accept in the ready states", () => {
        expect(bookRecords.safeParse(itemsOf(bookFixtures.rows.ready)).success).toBe(true)
        expect(entryRecord.safeParse(itemsOf(entryDetailFixtures.ready)).success).toBe(true)
        expect(entryRecord.safeParse(itemsOf(entryDetailFixtures.waiting)).success).toBe(true)
        expect(questionsRecord.safeParse(itemsOf(questionsFixtures.ready)).success).toBe(true)
        expect(questionsRecord.safeParse(itemsOf(questionsFixtures.waiting)).success).toBe(true)
        expect(figuresRecord.safeParse(itemsOf(periodFiguresFixtures.ready)).success).toBe(true)
        expect(dueRecord.safeParse(itemsOf(dueSoonFixtures.ready)).success).toBe(true)
        expect(ledgerRecord.safeParse(itemsOf(ledgerFixtures.ready)).success).toBe(true)
        expect(weeklyRecord.safeParse(itemsOf(weeklyFixtures.ready)).success).toBe(true)
        expect(ledgerRecord.safeParse(itemsOf(ledgerFixtures.waiting)).success).toBe(true)
    })

    it("has a fixture for every other status of each read", () => {
        const states = ["empty", "error", "loading", "forbidden"] as const
        expect(states.every((state) => state in bookFixtures.rows && state in bookFixtures.counts)).toBe(true)
        expect(states.every((state) => state in entryDetailFixtures && state in questionsFixtures)).toBe(true)
        expect(
            states.every(
                (state) =>
                    state in periodFiguresFixtures &&
                    state in dueSoonFixtures &&
                    state in ledgerFixtures &&
                    state in weeklyFixtures,
            ),
        ).toBe(true)
    })
})
