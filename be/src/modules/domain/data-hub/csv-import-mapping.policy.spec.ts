import type * as SubjectModule from "./csv-import-mapping.policy"
import { Test } from "@nestjs/testing"
import { blankMapping, carryMapping } from "./csv-import-mapping.policy"
import type { CsvConfig } from "./csv-import.contracts"

const SUBJECT = Symbol("csv-import-mapping.policy")
type Subject = Pick<typeof SubjectModule, "blankMapping" | "carryMapping">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { blankMapping, carryMapping } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const table = {
    headers: [
        "M\u00e3 KH",
        "H\u1ecd t\u00ean",
        "S\u0110T",
        "Email",
        "Ng\u00e0y t\u1ea1o",
        "Ghi ch\u00fa",
        "S\u1ed1 l\u01b0\u1ee3ng",
    ],
    rows: [
        ["KH1", "Lan", "0912345678", "lan@example.com", "14/10/2026", "", "2"],
        ["KH2", "Minh", "0987654321", "minh@example.com", "15/10/2026", "", "3"],
    ],
}

const saved: CsvConfig = {
    v: 1,
    source: "file",
    entity: "customer",
    idColumn: "M\u00e3 KH",
    titleColumn: "H\u1ecd t\u00ean",
    dateColumn: "Ng\u00e0y t\u1ea1o",
    kinds: { "M\u00e3 KH": "text", "H\u1ecd t\u00ean": "phone", "S\u0110T": "email" },
    columns: table.headers,
}

describe("blankMapping", () => {
    it("maps no id, title or date column whatever the headings say, and reads each column by its values", async () => {
        const subject = await buildSubject()

        expect(subject.blankMapping(table)).toEqual({
            idColumn: null,
            titleColumn: null,
            dateColumn: null,
            kinds: {
                "M\u00e3 KH": "text",
                "H\u1ecd t\u00ean": "text",
                "S\u0110T": "text",
                Email: "text",
                "Ng\u00e0y t\u1ea1o": "date",
                "Ghi ch\u00fa": "text",
                "S\u1ed1 l\u01b0\u1ee3ng": "number",
            },
            columns: table.headers,
        })
    })

    it("reads a date from the values alone, not from the heading", async () => {
        const subject = await buildSubject()

        const dated = subject.blankMapping({
            headers: ["Note", "Ng\u00e0y"],
            rows: [
                ["2026-10-14", "2026-10-14"],
                ["2026-10-15", "nope"],
            ],
        })
        expect(dated.kinds.Note).toBe("date")
        expect(dated.kinds["Ng\u00e0y"]).toBe("text")
        expect(dated.dateColumn).toBeNull()
    })

    it("does not call a mixed column a date or a number, and ignores a leading zero", async () => {
        const subject = await buildSubject()

        const mixed = subject.blankMapping({
            headers: ["Ng\u00e0y", "Qty", "Note", "Code"],
            rows: [
                ["2026-10-14", "0123", "2026-10-14", "5000"],
                ["nope", "2", "nope", "0123"],
                ["later", "3", "later", "7"],
            ],
        })
        expect(mixed.kinds).toEqual({ "Ng\u00e0y": "text", Qty: "text", Note: "text", Code: "text" })
    })

    it("reads a column of numbers as numbers, and missing cells as empty text", async () => {
        const subject = await buildSubject()

        expect(subject.blankMapping({ headers: ["Qty", "Notes"], rows: [["42"]] })).toEqual({
            idColumn: null,
            titleColumn: null,
            dateColumn: null,
            kinds: { Qty: "number", Notes: "text" },
            columns: ["Qty", "Notes"],
        })
        expect(subject.blankMapping({ headers: [], rows: [] })).toEqual({
            idColumn: null,
            titleColumn: null,
            dateColumn: null,
            kinds: {},
            columns: [],
        })
    })
})

describe("carryMapping", () => {
    it("keeps columns the new data still has, including a saved kind", async () => {
        const subject = await buildSubject()

        expect(subject.carryMapping(saved, table)).toMatchObject({
            idColumn: "M\u00e3 KH",
            titleColumn: "H\u1ecd t\u00ean",
            dateColumn: "Ng\u00e0y t\u1ea1o",
            kinds: { "H\u1ecd t\u00ean": "phone", "S\u0110T": "email", "Ghi ch\u00fa": "text" },
        })
    })

    it("leaves a saved column unmapped when the new data no longer has it", async () => {
        const subject = await buildSubject()

        expect(
            subject.carryMapping(
                { ...saved, idColumn: "gone", titleColumn: "gone", dateColumn: "gone" },
                { headers: ["Email"], rows: [["a@b.c"]] },
            ),
        ).toMatchObject({ idColumn: null, titleColumn: null, dateColumn: null })
    })

    it("preserves inherited prototype-header kinds and the order of mapped headers", async () => {
        const subject = await buildSubject()

        const carried = subject.carryMapping(saved, { headers: ["__proto__", "Note"], rows: [["123", "words"]] })
        expect(Object.hasOwn(carried.kinds, "__proto__")).toBe(true)
        expect(Reflect.get(carried.kinds, "__proto__")).toBe(Object.prototype)
        expect(Object.keys(carried.kinds)).toEqual(["__proto__", "Note"])
        expect(carried.kinds.Note).toBe("text")
    })

    it("reads the kind of a header with no saved entry from its values, including text for empty cells", async () => {
        const subject = await buildSubject()

        const kinds: CsvConfig["kinds"] = {}
        Reflect.set(kinds, "Qty", null)
        expect(
            subject.carryMapping(
                { ...saved, idColumn: null, titleColumn: null, dateColumn: null, kinds },
                { headers: ["Qty", "Note"], rows: [["42"]] },
            ),
        ).toEqual({
            idColumn: null,
            titleColumn: null,
            dateColumn: null,
            kinds: { Qty: "number", Note: "text" },
            columns: ["Qty", "Note"],
        })
    })

    it("uses text for a header the provider adds after the blank mapping was built", async () => {
        const subject = await buildSubject()

        let reads = 0
        const changing = {
            get headers(): Array<string> {
                reads += 1
                return reads === 1 ? ["Qty"] : ["Note"]
            },
            rows: [["42"]],
        }
        expect(
            subject.carryMapping(
                { ...saved, idColumn: null, titleColumn: null, dateColumn: null, kinds: {} },
                changing,
            ),
        ).toEqual({
            idColumn: null,
            titleColumn: null,
            dateColumn: null,
            kinds: { Note: "text" },
            columns: ["Note"],
        })
    })
})
