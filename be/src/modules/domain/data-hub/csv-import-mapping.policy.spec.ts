import { carryMapping, suggestMapping } from "./csv-import-mapping.policy"
import type { CsvConfig } from "./csv-import.contracts"

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

describe("suggestMapping", () => {
    it("guesses the customer id, name, phone, email, date and a quantity", () => {
        expect(suggestMapping(table, "customer")).toEqual({
            idColumn: "M\u00e3 KH",
            titleColumn: "H\u1ecd t\u00ean",
            dateColumn: "Ng\u00e0y t\u1ea1o",
            kinds: {
                "M\u00e3 KH": "text",
                "H\u1ecd t\u00ean": "text",
                "S\u0110T": "phone",
                Email: "email",
                "Ng\u00e0y t\u1ea1o": "date",
                "Ghi ch\u00fa": "text",
                "S\u1ed1 l\u01b0\u1ee3ng": "number",
            },
            columns: table.headers,
        })
    })

    it("uses a product name and an order title, and only a code as the id", () => {
        const product = {
            headers: ["T\u00ean s\u1ea3n ph\u1ea9m", "Gi\u00e1"],
            rows: [["Tr\u00e0", "50000"]],
        }
        expect(suggestMapping(product, "product")).toMatchObject({
            idColumn: null,
            titleColumn: "T\u00ean s\u1ea3n ph\u1ea9m",
            kinds: { "T\u00ean s\u1ea3n ph\u1ea9m": "text", "Gi\u00e1": "number" },
        })
        const order = { headers: ["M\u00e3 \u0111\u01a1n", "Kh\u00e1ch h\u00e0ng"], rows: [["D1", "Lan"]] }
        expect(suggestMapping(order, "order")).toMatchObject({
            idColumn: "M\u00e3 \u0111\u01a1n",
            titleColumn: "M\u00e3 \u0111\u01a1n",
        })
    })

    it("falls back from a code to an email, then a phone, for a customer", () => {
        expect(suggestMapping({ headers: ["Email", "S\u0110T"], rows: [["a@b.c", "0912"]] }, "customer").idColumn).toBe(
            "Email",
        )
        expect(suggestMapping({ headers: ["S\u0110T"], rows: [["0912"]] }, "customer").idColumn).toBe("S\u0110T")
        expect(suggestMapping({ headers: ["S\u0110T"], rows: [["0912"]] }, "other").idColumn).toBeNull()
    })

    it("reads a date from the values, and from the heading when most values are dates", () => {
        const dated = suggestMapping(
            {
                headers: ["Note", "Ng\u00e0y"],
                rows: [
                    ["2026-10-14", "2026-10-14"],
                    ["2026-10-15", "nope"],
                ],
            },
            "other",
        )
        expect(dated.kinds.Note).toBe("date")
        expect(dated.kinds["Ng\u00e0y"]).toBe("date")
        expect(dated.dateColumn).toBe("Ng\u00e0y")
    })

    it("keeps a code as text even when the cells are digits, and ignores a leading zero", () => {
        const coded = suggestMapping(
            { headers: ["M\u00e3", "S\u1ed1 ti\u1ec1n", "Phone book"], rows: [["0123", "5000", "0123"]] },
            "other",
        )
        expect(coded.kinds["M\u00e3"]).toBe("text")
        expect(coded.kinds["S\u1ed1 ti\u1ec1n"]).toBe("number")
        expect(coded.kinds["Phone book"]).toBe("phone")
        expect(coded.idColumn).toBe("M\u00e3")
    })

    it("does not call a mixed column a date or a number", () => {
        const mixed = suggestMapping(
            {
                headers: ["Ng\u00e0y", "Qty", "Note"],
                rows: [
                    ["2026-10-14", "0123", "2026-10-14"],
                    ["nope", "2", "nope"],
                    ["later", "3", "later"],
                ],
            },
            "other",
        )
        expect(mixed.kinds["Ng\u00e0y"]).toBe("text")
        expect(mixed.kinds.Qty).toBe("text")
        expect(mixed.kinds.Note).toBe("text")
        expect(mixed.dateColumn).toBeNull()
    })

    it("uses the first text column, then the first header, when no name heading exists", () => {
        expect(suggestMapping({ headers: ["id", "city"], rows: [["1", "Hue"]] }, "other")).toMatchObject({
            idColumn: "id",
            titleColumn: "city",
        })
        expect(suggestMapping({ headers: ["id"], rows: [["1"]] }, "other").titleColumn).toBe("id")
        expect(suggestMapping({ headers: [], rows: [] }, "other")).toEqual({
            idColumn: null,
            titleColumn: null,
            dateColumn: null,
            kinds: {},
            columns: [],
        })
    })

    it("uses the first date column when none of the date headings match", () => {
        const mapped = suggestMapping({ headers: ["Opened"], rows: [["2026-10-14"], ["2026-10-15"]] }, "other")
        expect(mapped.kinds.Opened).toBe("date")
        expect(mapped.dateColumn).toBe("Opened")
    })

    it("reads missing cells as empty text and recognises a code prefix beyond an exact heading", () => {
        expect(suggestMapping({ headers: ["sku internal", "Notes"], rows: [["0012"]] }, "product")).toEqual({
            idColumn: "sku internal",
            titleColumn: "Notes",
            dateColumn: null,
            kinds: { "sku internal": "text", Notes: "text" },
            columns: ["sku internal", "Notes"],
        })
    })

    it("keeps a number-like code prefix as text but reads a quantity as a number", () => {
        expect(suggestMapping({ headers: ["so internal", "so luong"], rows: [["123", "42"]] }, "other")).toEqual({
            idColumn: null,
            titleColumn: "so internal",
            dateColumn: null,
            kinds: { "so internal": "text", "so luong": "number" },
            columns: ["so internal", "so luong"],
        })
    })
})

describe("carryMapping", () => {
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

    it("keeps columns the new data still has, including a saved kind", () => {
        expect(carryMapping(saved, table)).toMatchObject({
            idColumn: "M\u00e3 KH",
            titleColumn: "H\u1ecd t\u00ean",
            dateColumn: "Ng\u00e0y t\u1ea1o",
            kinds: { "H\u1ecd t\u00ean": "phone", "S\u0110T": "email", "Ghi ch\u00fa": "text" },
        })
    })

    it("falls back when a saved column is gone, and keeps an explicit empty id or date", () => {
        const fresh = suggestMapping({ headers: ["Email"], rows: [["a@b.c"]] }, "customer")
        expect(
            carryMapping(
                { ...saved, idColumn: "gone", titleColumn: "gone", dateColumn: "gone" },
                { headers: ["Email"], rows: [["a@b.c"]] },
            ),
        ).toMatchObject({
            idColumn: fresh.idColumn,
            titleColumn: fresh.titleColumn,
            dateColumn: fresh.dateColumn,
        })
        expect(
            carryMapping(
                { ...saved, idColumn: null, titleColumn: null, dateColumn: null },
                { headers: ["Email"], rows: [["a@b.c"]] },
            ),
        ).toMatchObject({ idColumn: null, dateColumn: null, titleColumn: "Email" })
    })

    it("preserves inherited prototype-header kinds and the order of mapped headers", () => {
        const carried = carryMapping(saved, { headers: ["__proto__", "Note"], rows: [["123", "words"]] })
        expect(Object.hasOwn(carried.kinds, "__proto__")).toBe(true)
        expect(Reflect.get(carried.kinds, "__proto__")).toBe(Object.prototype)
        expect(Object.keys(carried.kinds)).toEqual(["__proto__", "Note"])
        expect(carried.kinds.Note).toBe("text")
    })
})
