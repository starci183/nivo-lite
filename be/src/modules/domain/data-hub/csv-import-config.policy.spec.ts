import { CSV_NO_COLUMN } from "./csv-import.contracts"
import {
    cleanImportName,
    cleanMapping,
    invalid,
    isPlainObject,
    isSchedule,
    mappingOf,
    missingColumns,
    readConfig,
    summaryOf,
    tableEntityOf,
} from "./csv-import-config.policy"
import { DataHubErrorCode } from "./errors/data-hub.error"
import { CSV_COPY } from "./messages/csv-import.messages"

const refused = (detail: string) => ({ code: DataHubErrorCode.Invalid, params: { detail } })

const config = {
    v: 1 as const,
    source: "sheet" as const,
    entity: "customer" as const,
    idColumn: "id",
    titleColumn: "name",
    dateColumn: "when",
    kinds: { id: "text" as const, name: "email" as const },
    columns: ["id", "name"],
    sheet: "Customers",
    link: "https://docs.google.com/spreadsheets/d/sheet-1",
}

describe("invalid", () => {
    it("carries the sentence the owner reads", () => {
        expect(invalid("nope")).toMatchObject(refused("nope"))
    })
})

describe("summaryOf", () => {
    it("counts rows or documents in Vietnamese grouping", () => {
        expect(summaryOf("customer", 1200)).toBe(`${CSV_COPY.entity.customer} \u00b7 1.200 ${CSV_COPY.rowUnit}`)
        expect(summaryOf("document", 2)).toBe(`${CSV_COPY.entity.document} \u00b7 2 ${CSV_COPY.documentUnit}`)
    })
})

describe("isPlainObject", () => {
    it("accepts a plain object and rejects a list or a null", () => {
        expect(isPlainObject({ a: 1 })).toBe(true)
        expect(isPlainObject([])).toBe(false)
        expect(isPlainObject(null)).toBe(false)
        expect(isPlainObject("x")).toBe(false)
    })
})

describe("readConfig", () => {
    it("reads a saved setup, including optional sheet and link", () => {
        expect(readConfig({ config: JSON.stringify(config) })).toEqual(config)
    })

    it("omits a sheet or link that is not text and drops unknown kinds and columns", () => {
        expect(
            readConfig({
                config: JSON.stringify({
                    ...config,
                    sheet: 1,
                    link: null,
                    kinds: { id: "text", extra: "nope", skip: 1 },
                    columns: ["id", 2, null],
                    idColumn: "",
                    titleColumn: null,
                    dateColumn: 4,
                }),
            }),
        ).toEqual({
            v: 1,
            source: "sheet",
            entity: "customer",
            idColumn: null,
            titleColumn: null,
            dateColumn: null,
            kinds: { id: "text" },
            columns: ["id"],
        })
    })

    it.each([
        ["missing meta", null],
        ["undefined meta", undefined],
        ["no config", {}],
        ["broken json", { config: "{" }],
        ["a list", { config: "[]" }],
        ["the wrong version", { config: JSON.stringify({ ...config, v: 2 }) }],
        ["an unknown source", { config: JSON.stringify({ ...config, source: "mail" }) }],
        ["a non-text source", { config: JSON.stringify({ ...config, source: 1 }) }],
        ["an unknown entity", { config: JSON.stringify({ ...config, entity: "lead" }) }],
        ["a non-text entity", { config: JSON.stringify({ ...config, entity: null }) }],
    ])("returns null for %s", (_label, meta) => {
        expect(readConfig(meta)).toBeNull()
    })

    it("ignores kinds that are not an object and columns that are not a list", () => {
        expect(readConfig({ config: JSON.stringify({ ...config, kinds: ["text"] }) })?.kinds).toEqual({})
        expect(readConfig({ config: JSON.stringify({ ...config, columns: "id" }) })?.columns).toEqual([])
    })
})

describe("isSchedule", () => {
    it.each([null, 60, 360, 1440])("accepts %s", (value) => {
        expect(isSchedule(value)).toBe(true)
    })

    it("rejects a schedule the sheet link cannot take", () => {
        expect(isSchedule(15)).toBe(false)
        expect(isSchedule("60")).toBe(false)
    })
})

describe("mappingOf", () => {
    it("keeps the mapping fields of a config", () => {
        expect(mappingOf(config)).toEqual({
            idColumn: "id",
            titleColumn: "name",
            dateColumn: "when",
            kinds: config.kinds,
            columns: ["id", "name"],
        })
    })
})

describe("missingColumns", () => {
    it("names the mapped columns the new headers dropped", () => {
        expect(missingColumns({ idColumn: "id", titleColumn: "", dateColumn: null }, ["name"])).toEqual(["id"])
        expect(
            missingColumns({ idColumn: "id", titleColumn: "name", dateColumn: "when" }, ["id", "name", "when"]),
        ).toEqual([])
    })
})

describe("tableEntityOf", () => {
    it.each(["customer", "order", "product", "transaction", "other"] as const)("accepts %s", (entity) => {
        expect(tableEntityOf(entity)).toBe(entity)
    })

    it.each([null, undefined, "document", "lead"])("refuses %s", (raw) => {
        expect(() => tableEntityOf(raw)).toThrow(expect.objectContaining(refused(CSV_COPY.chooseEntity)))
    })
})

describe("cleanImportName", () => {
    it("trims, collapses spaces and stops at 60 characters", () => {
        expect(cleanImportName("  Kh\u00e1ch  h\u00e0ng  ")).toBe("Kh\u00e1ch h\u00e0ng")
        expect(cleanImportName(` ${"a".repeat(80)} `)).toBe("a".repeat(60))
    })

    it.each([null, undefined, " a "])("refuses %s", (raw) => {
        expect(() => cleanImportName(raw)).toThrow(expect.objectContaining(refused(CSV_COPY.nameTooShort)))
    })
})

describe("cleanMapping", () => {
    const headers = ["id", "name"]

    it("keeps a real header and a known kind, and treats a missing kind as text", () => {
        expect(
            cleanMapping(
                { idColumn: "id", titleColumn: CSV_NO_COLUMN, dateColumn: "", kinds: { id: "phone", name: "nope" } },
                headers,
            ),
        ).toEqual({
            idColumn: "id",
            titleColumn: null,
            dateColumn: null,
            kinds: { id: "phone", name: "text" },
            columns: ["id", "name"],
        })
    })

    it("treats null and undefined as no column", () => {
        expect(cleanMapping({ idColumn: null, titleColumn: undefined, dateColumn: null }, headers)).toMatchObject({
            idColumn: null,
            titleColumn: null,
            dateColumn: null,
        })
    })

    it("refuses a column the data does not have", () => {
        expect(() => cleanMapping({ idColumn: "missing-column" }, headers)).toThrow(
            expect.objectContaining(refused(CSV_COPY.columnMissing("missing-column"))),
        )
        expect(() => cleanMapping({ idColumn: 4 }, headers)).toThrow(
            expect.objectContaining(refused(CSV_COPY.columnMissing(""))),
        )
    })

    it("reads a mapping that is not an object as empty choices", () => {
        expect(cleanMapping(null, headers)).toEqual({
            idColumn: null,
            titleColumn: null,
            dateColumn: null,
            kinds: { id: "text", name: "text" },
            columns: ["id", "name"],
        })
    })
})
