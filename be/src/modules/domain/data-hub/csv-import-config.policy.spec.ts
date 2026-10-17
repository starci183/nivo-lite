import type * as SubjectModule from "./csv-import-config.policy"
import { Test } from "@nestjs/testing"
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

const SUBJECT = Symbol("csv-import-config.policy")
type Subject = Pick<
    typeof SubjectModule,
    | "invalid"
    | "summaryOf"
    | "isPlainObject"
    | "readConfig"
    | "isSchedule"
    | "mappingOf"
    | "missingColumns"
    | "tableEntityOf"
    | "cleanImportName"
    | "cleanMapping"
>

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    invalid,
                    summaryOf,
                    isPlainObject,
                    readConfig,
                    isSchedule,
                    mappingOf,
                    missingColumns,
                    tableEntityOf,
                    cleanImportName,
                    cleanMapping,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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

const headers = ["id", "name"]

describe("invalid", () => {
    it("carries the sentence the owner reads", async () => {
        const subject = await buildSubject()

        expect(subject.invalid("nope")).toMatchObject(refused("nope"))
    })
})

describe("summaryOf", () => {
    it("counts rows or documents in Vietnamese grouping", async () => {
        const subject = await buildSubject()

        expect(subject.summaryOf("customer", 1200)).toBe(`${CSV_COPY.entity.customer} \u00b7 1.200 ${CSV_COPY.rowUnit}`)
        expect(subject.summaryOf("document", 2)).toBe(`${CSV_COPY.entity.document} \u00b7 2 ${CSV_COPY.documentUnit}`)
    })
})

describe("isPlainObject", () => {
    it("accepts a plain object and rejects a list or a null", async () => {
        const subject = await buildSubject()

        expect(subject.isPlainObject({ a: 1 })).toBe(true)
        expect(subject.isPlainObject([])).toBe(false)
        expect(subject.isPlainObject(null)).toBe(false)
        expect(subject.isPlainObject("x")).toBe(false)
    })
})

describe("readConfig", () => {
    it("reads a saved setup, including optional sheet and link", async () => {
        const subject = await buildSubject()

        expect(subject.readConfig({ config: JSON.stringify(config) })).toEqual(config)
    })

    it("omits a sheet or link that is not text and drops unknown kinds and columns", async () => {
        const subject = await buildSubject()

        expect(
            subject.readConfig({
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
    ])("returns null for %s", async (_label, meta) => {
        const subject = await buildSubject()

        expect(subject.readConfig(meta)).toBeNull()
    })

    it("ignores kinds that are not an object and columns that are not a list", async () => {
        const subject = await buildSubject()

        expect(subject.readConfig({ config: JSON.stringify({ ...config, kinds: ["text"] }) })?.kinds).toEqual({})
        expect(subject.readConfig({ config: JSON.stringify({ ...config, columns: "id" }) })?.columns).toEqual([])
    })
})

describe("isSchedule", () => {
    it.each([null, 60, 360, 1440])("accepts %s", async (value) => {
        const subject = await buildSubject()

        expect(subject.isSchedule(value)).toBe(true)
    })

    it("rejects a schedule the sheet link cannot take", async () => {
        const subject = await buildSubject()

        expect(subject.isSchedule(15)).toBe(false)
        expect(subject.isSchedule("60")).toBe(false)
    })
})

describe("mappingOf", () => {
    it("keeps the mapping fields of a config", async () => {
        const subject = await buildSubject()

        expect(subject.mappingOf(config)).toEqual({
            idColumn: "id",
            titleColumn: "name",
            dateColumn: "when",
            kinds: config.kinds,
            columns: ["id", "name"],
        })
    })
})

describe("missingColumns", () => {
    it("names the mapped columns the new headers dropped", async () => {
        const subject = await buildSubject()

        expect(subject.missingColumns({ idColumn: "id", titleColumn: "", dateColumn: null }, ["name"])).toEqual(["id"])
        expect(
            subject.missingColumns({ idColumn: "id", titleColumn: "name", dateColumn: "when" }, ["id", "name", "when"]),
        ).toEqual([])
    })
})

describe("tableEntityOf", () => {
    it.each(["customer", "order", "product", "transaction", "other"] as const)("accepts %s", async (entity) => {
        const subject = await buildSubject()

        expect(subject.tableEntityOf(entity)).toBe(entity)
    })

    it.each([null, undefined, "document", "lead"])("refuses %s", async (raw) => {
        const subject = await buildSubject()

        expect(() => subject.tableEntityOf(raw)).toThrow(expect.objectContaining(refused(CSV_COPY.chooseEntity)))
    })
})

describe("cleanImportName", () => {
    it("trims, collapses spaces and stops at 60 characters", async () => {
        const subject = await buildSubject()

        expect(subject.cleanImportName("  Kh\u00e1ch  h\u00e0ng  ")).toBe("Kh\u00e1ch h\u00e0ng")
        expect(subject.cleanImportName(` ${"a".repeat(80)} `)).toBe("a".repeat(60))
    })

    it.each([null, undefined, " a "])("refuses %s", async (raw) => {
        const subject = await buildSubject()

        expect(() => subject.cleanImportName(raw)).toThrow(expect.objectContaining(refused(CSV_COPY.nameTooShort)))
    })
})

describe("cleanMapping", () => {
    it("keeps a real header and a known kind, and treats a missing kind as text", async () => {
        const subject = await buildSubject()

        expect(
            subject.cleanMapping(
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

    it("treats null and undefined as no column", async () => {
        const subject = await buildSubject()

        expect(
            subject.cleanMapping({ idColumn: null, titleColumn: undefined, dateColumn: null }, headers),
        ).toMatchObject({
            idColumn: null,
            titleColumn: null,
            dateColumn: null,
        })
    })

    it("refuses a column the data does not have", async () => {
        const subject = await buildSubject()

        expect(() => subject.cleanMapping({ idColumn: "missing-column" }, headers)).toThrow(
            expect.objectContaining(refused(CSV_COPY.columnMissing("missing-column"))),
        )
        expect(() => subject.cleanMapping({ idColumn: 4 }, headers)).toThrow(
            expect.objectContaining(refused(CSV_COPY.columnMissing(""))),
        )
    })

    it("reads a mapping that is not an object as empty choices", async () => {
        const subject = await buildSubject()

        expect(subject.cleanMapping(null, headers)).toEqual({
            idColumn: null,
            titleColumn: null,
            dateColumn: null,
            kinds: { id: "text", name: "text" },
            columns: ["id", "name"],
        })
    })
})
