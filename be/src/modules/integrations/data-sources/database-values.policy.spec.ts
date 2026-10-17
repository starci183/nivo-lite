import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { DatabaseRow, DatabaseSelection } from "./database-session.contracts"
import { DATABASE_COPY } from "./messages/database.messages"
import { cursorOf, isPlainObject, plainValue, previewCells, toRecord, toRows } from "./database-values.policy"

const SUBJECT = Symbol("database-values.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { cursorOf, isPlainObject, plainValue, previewCells, toRecord, toRows } },
        ],
    }).compile()
    return moduleRef.get<
        Pick<
            typeof import("./database-values.policy"),
            "cursorOf" | "isPlainObject" | "plainValue" | "previewCells" | "toRecord" | "toRows"
        >
    >(SUBJECT)
}

const registerIsPlainObjectAndToRows = () => {
    describe("isPlainObject and toRows", () => {
        it("keeps plain objects and drops everything else", async () => {
            const subject = await buildSubject()

            expect(subject.isPlainObject({ id: 1 })).toBe(true)
            expect(subject.isPlainObject([1])).toBe(false)
            expect(subject.isPlainObject(null)).toBe(false)
            expect(subject.isPlainObject("id")).toBe(false)

            const row: DatabaseRow = { id: "1" }
            expect(subject.toRows([row, ["no"], null])).toEqual([row])
            expect(subject.toRows("no")).toEqual([])
        })
    })

    describe("plainValue", () => {
        it("keeps JSON-safe scalars and rewrites the ones that are not", async () => {
            const subject = await buildSubject()

            const instant = new Date("2026-01-02T03:04:05.000Z")
            const long = "x".repeat(4001)
            const nested = { n: 1n, ok: true }
            const bulky = { text: "y".repeat(4000) }

            expect(subject.plainValue(null)).toBeNull()
            expect(subject.plainValue(undefined)).toBeNull()
            expect(subject.plainValue(1n)).toBe("1")
            expect(subject.plainValue(1.5)).toBe(1.5)
            expect(subject.plainValue(Number.POSITIVE_INFINITY)).toBe("Infinity")
            expect(subject.plainValue(true)).toBe(true)
            expect(subject.plainValue("ok")).toBe("ok")
            expect(subject.plainValue(long)).toBe(`${"x".repeat(4000)}...`)
            expect(subject.plainValue(instant)).toBe("2026-01-02T03:04:05.000Z")
            expect(subject.plainValue(new Date(Number.NaN))).toBeNull()
            expect(subject.plainValue(new Uint8Array(3))).toBe(DATABASE_COPY.binary(3))
            expect(subject.plainValue(nested)).toEqual(nested)
            expect(subject.plainValue(() => undefined)).toBeNull()
            expect(subject.plainValue(bulky)).toBe(`${JSON.stringify(bulky).slice(0, 4000)}...`)
        })
    })
}

const registerRecordValues = () => {
    describe("toRecord", () => {
        it("skips a row with no id and fills title, time and data from the rest", async () => {
            const subject = await buildSubject()

            expect(subject.toRecord(selection(), { id: null })).toBeNull()
            expect(subject.toRecord(selection(), { id: undefined })).toBeNull()
            expect(subject.toRecord(selection(), { id: "" })).toBeNull()

            const spaced = "2026-01-02 03:04:05"
            const record = subject.toRecord(selection(), {
                id: 12,
                title: "Order",
                updated_at: spaced,
                note: 1n,
            })

            expect(record).toEqual({
                externalId: "12",
                title: "Order",
                occurredAt: new Date("2026-01-02T03:04:05").toISOString(),
                data: { note: "1" },
            })
        })

        it("uses the id as the title and drops a time that cannot be read", async () => {
            const subject = await buildSubject()

            expect(subject.toRecord(selection({ titleColumn: "", updatedColumn: "" }), { id: "a-1" })).toEqual({
                externalId: "a-1",
                title: "a-1",
                occurredAt: null,
                data: { note: null },
            })
            expect(
                subject.toRecord(selection(), { id: "a-1", title: null, updated_at: "yesterday", note: true })
                    ?.occurredAt,
            ).toBeNull()
            expect(
                subject.toRecord(selection(), { id: "a-1", title: undefined, updated_at: "", note: false })?.title,
            ).toBe("a-1")
            expect(subject.toRecord(selection(), { id: "a-1", updated_at: 1_700_000_000_000 })?.occurredAt).toBe(
                new Date(1_700_000_000_000).toISOString(),
            )
            expect(subject.toRecord(selection(), { id: "a-1", updated_at: false })?.occurredAt).toBeNull()
            expect(
                subject.toRecord(selection(), { id: "a-1", updated_at: new Date(Number.NaN) })?.occurredAt,
            ).toBeNull()
            expect(
                subject.toRecord(selection(), { id: "a-1", updated_at: new Date("2026-03-04T00:00:00.000Z") })
                    ?.occurredAt,
            ).toBe("2026-03-04T00:00:00.000Z")
        })
    })
}

const registerRecordFallbacks = () => {
    describe("toRecord", () => {
        it("keeps missing and null update times empty", async () => {
            const subject = await buildSubject()

            const expected = {
                externalId: "a-1",
                title: "a-1",
                occurredAt: null,
                data: { note: null },
            }

            expect(subject.toRecord(selection(), { id: "a-1", updated_at: null })).toEqual(expected)
            expect(subject.toRecord(selection(), { id: "a-1" })).toEqual(expected)
        })

        it("uses empty title text when a value stops producing JSON after inspection", async () => {
            const subject = await buildSubject()

            const serializer = mock<{ serialize(): unknown }>()
            serializer.serialize.mockReturnValueOnce({ label: "first" }).mockReturnValueOnce(undefined)
            const title = { toJSON: serializer.serialize }

            expect(subject.toRecord(selection(), { id: "a-1", title })).toEqual({
                externalId: "a-1",
                title: "",
                occurredAt: null,
                data: { note: null },
            })
            expect(serializer.serialize).toHaveBeenCalledTimes(2)
        })
    })
}

const registerToRecord = () => {
    registerRecordValues()
    registerRecordFallbacks()
}

const registerCursorOfAndPreviewCells = () => {
    describe("cursorOf and previewCells", () => {
        it("reads the newest cursor and cuts preview cells to eighty characters", async () => {
            const subject = await buildSubject()

            const rows: ReadonlyArray<DatabaseRow> = [
                { __nivo_cursor: "older" },
                { __nivo_cursor: null },
                { __nivo_cursor: 9 },
            ]

            expect(subject.cursorOf([])).toBeNull()
            expect(subject.cursorOf([{ __nivo_cursor: null }, { __nivo_cursor: undefined }])).toBeNull()
            expect(subject.cursorOf(rows)).toBe("9")

            const long = "z".repeat(90)
            expect(subject.previewCells(["note", "empty"], [{ note: long, empty: null }, { note: 4 }])).toEqual([
                ["z".repeat(80), ""],
                ["4", ""],
            ])
        })

        it("skips an absent row at the end of a sparse cursor page", async () => {
            const subject = await buildSubject()

            const rows = new Array<DatabaseRow>(2)
            rows[0] = { __nivo_cursor: "older" }

            expect(subject.cursorOf(rows)).toBe("older")
        })
    })
}

const selection = (partial: Partial<DatabaseSelection> = {}): DatabaseSelection => ({
    schema: "public",
    table: "orders",
    idColumn: "id",
    titleColumn: "title",
    updatedColumn: "updated_at",
    columns: ["note"],
    ...partial,
})

describe("database values", () => {
    registerIsPlainObjectAndToRows()
    registerToRecord()
    registerCursorOfAndPreviewCells()
})
