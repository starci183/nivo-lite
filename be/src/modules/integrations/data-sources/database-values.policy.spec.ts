import { mock } from "@starci/jest-preset"
import type { DatabaseRow, DatabaseSelection } from "./database-session.contracts"
import { DATABASE_COPY } from "./messages/database.messages"
import { cursorOf, isPlainObject, plainValue, previewCells, toRecord, toRows } from "./database-values.policy"

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
    describe("isPlainObject and toRows", () => {
        it("keeps plain objects and drops everything else", () => {
            expect(isPlainObject({ id: 1 })).toBe(true)
            expect(isPlainObject([1])).toBe(false)
            expect(isPlainObject(null)).toBe(false)
            expect(isPlainObject("id")).toBe(false)

            const row: DatabaseRow = { id: "1" }
            expect(toRows([row, ["no"], null])).toEqual([row])
            expect(toRows("no")).toEqual([])
        })
    })

    describe("plainValue", () => {
        it("keeps JSON-safe scalars and rewrites the ones that are not", () => {
            const instant = new Date("2026-01-02T03:04:05.000Z")
            const long = "x".repeat(4001)
            const nested = { n: 1n, ok: true }
            const bulky = { text: "y".repeat(4000) }

            expect(plainValue(null)).toBeNull()
            expect(plainValue(undefined)).toBeNull()
            expect(plainValue(1n)).toBe("1")
            expect(plainValue(1.5)).toBe(1.5)
            expect(plainValue(Number.POSITIVE_INFINITY)).toBe("Infinity")
            expect(plainValue(true)).toBe(true)
            expect(plainValue("ok")).toBe("ok")
            expect(plainValue(long)).toBe(`${"x".repeat(4000)}...`)
            expect(plainValue(instant)).toBe("2026-01-02T03:04:05.000Z")
            expect(plainValue(new Date(Number.NaN))).toBeNull()
            expect(plainValue(new Uint8Array(3))).toBe(DATABASE_COPY.binary(3))
            expect(plainValue(nested)).toEqual(nested)
            expect(plainValue(() => undefined)).toBeNull()
            expect(plainValue(bulky)).toBe(`${JSON.stringify(bulky).slice(0, 4000)}...`)
        })
    })

    describe("toRecord", () => {
        it("skips a row with no id and fills title, time and data from the rest", () => {
            expect(toRecord(selection(), { id: null })).toBeNull()
            expect(toRecord(selection(), { id: undefined })).toBeNull()
            expect(toRecord(selection(), { id: "" })).toBeNull()

            const spaced = "2026-01-02 03:04:05"
            const record = toRecord(selection(), {
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

        it("uses the id as the title and drops a time that cannot be read", () => {
            expect(toRecord(selection({ titleColumn: "", updatedColumn: "" }), { id: "a-1" })).toEqual({
                externalId: "a-1",
                title: "a-1",
                occurredAt: null,
                data: { note: null },
            })
            expect(
                toRecord(selection(), { id: "a-1", title: null, updated_at: "yesterday", note: true })?.occurredAt,
            ).toBeNull()
            expect(toRecord(selection(), { id: "a-1", title: undefined, updated_at: "", note: false })?.title).toBe(
                "a-1",
            )
            expect(toRecord(selection(), { id: "a-1", updated_at: 1_700_000_000_000 })?.occurredAt).toBe(
                new Date(1_700_000_000_000).toISOString(),
            )
            expect(toRecord(selection(), { id: "a-1", updated_at: false })?.occurredAt).toBeNull()
            expect(toRecord(selection(), { id: "a-1", updated_at: new Date(Number.NaN) })?.occurredAt).toBeNull()
            expect(
                toRecord(selection(), { id: "a-1", updated_at: new Date("2026-03-04T00:00:00.000Z") })?.occurredAt,
            ).toBe("2026-03-04T00:00:00.000Z")
        })

        it("keeps missing and null update times empty", () => {
            const expected = {
                externalId: "a-1",
                title: "a-1",
                occurredAt: null,
                data: { note: null },
            }

            expect(toRecord(selection(), { id: "a-1", updated_at: null })).toEqual(expected)
            expect(toRecord(selection(), { id: "a-1" })).toEqual(expected)
        })

        it("uses empty title text when a value stops producing JSON after inspection", () => {
            const serializer = mock<{ serialize(): unknown }>()
            serializer.serialize.mockReturnValueOnce({ label: "first" }).mockReturnValueOnce(undefined)
            const title = { toJSON: serializer.serialize }

            expect(toRecord(selection(), { id: "a-1", title })).toEqual({
                externalId: "a-1",
                title: "",
                occurredAt: null,
                data: { note: null },
            })
            expect(serializer.serialize).toHaveBeenCalledTimes(2)
        })
    })

    describe("cursorOf and previewCells", () => {
        it("reads the newest cursor and cuts preview cells to eighty characters", () => {
            const rows: ReadonlyArray<DatabaseRow> = [
                { __nivo_cursor: "older" },
                { __nivo_cursor: null },
                { __nivo_cursor: 9 },
            ]

            expect(cursorOf([])).toBeNull()
            expect(cursorOf([{ __nivo_cursor: null }, { __nivo_cursor: undefined }])).toBeNull()
            expect(cursorOf(rows)).toBe("9")

            const long = "z".repeat(90)
            expect(previewCells(["note", "empty"], [{ note: long, empty: null }, { note: 4 }])).toEqual([
                ["z".repeat(80), ""],
                ["4", ""],
            ])
        })

        it("skips an absent row at the end of a sparse cursor page", () => {
            const rows = new Array<DatabaseRow>(2)
            rows[0] = { __nivo_cursor: "older" }

            expect(cursorOf(rows)).toBe("older")
        })
    })
})
