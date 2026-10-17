import { Test } from "@nestjs/testing"
import { parseItemTable, skuFromName } from "./item-table.policy"

const SUBJECT = Symbol("item-table.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parseItemTable, skuFromName } }],
    }).compile()
    return moduleRef.get<typeof import("./item-table.policy")>(SUBJECT)
}

describe("parseItemTable", () => {
    it("reads a table whose first row names the columns", async () => {
        const subject = await buildSubject()
        const text = [
            "Ten hang\tDon vi\tGia von\tGia ban\tTon toi thieu\tSo luong nhap\tTon\tNha cung cap\tMa",
            "Flour\tkg\t12.000\t15000\t5\t20\t8\tMill Co\tFL-1",
        ].join("\n")
        expect(subject.parseItemTable(text, "piece")).toEqual({
            rows: [
                {
                    sku: "FL-1",
                    name: "Flour",
                    unit: "kg",
                    category: "",
                    costVnd: 12_000,
                    sellPriceVnd: 15_000,
                    reorderPoint: 5,
                    reorderQty: 20,
                    qty: 8,
                    supplier: "Mill Co",
                },
            ],
            skipped: [],
        })
    })
    it("reads a table without a header in the default column order", async () => {
        const subject = await buildSubject()
        const text = "SKU1,Sugar,kg,Pantry,10,12,2,10,4,Sweet Ltd"
        expect(subject.parseItemTable(text, "piece").rows).toEqual([
            {
                sku: "SKU1",
                name: "Sugar",
                unit: "kg",
                category: "Pantry",
                costVnd: 10,
                sellPriceVnd: 12,
                reorderPoint: 2,
                reorderQty: 10,
                qty: 4,
                supplier: "Sweet Ltd",
            },
        ])
    })
    it("uses the default unit, no price and no stock when the cells are empty", async () => {
        const subject = await buildSubject()
        const [row] = subject.parseItemTable("A1;Salt", "piece").rows
        expect(row).toMatchObject({ sku: "A1", name: "Salt", unit: "piece", sellPriceVnd: null, qty: null, costVnd: 0 })
    })
    it("keeps a quoted separator inside a cell", async () => {
        const subject = await buildSubject()
        const [row] = subject.parseItemTable('A1,"Salt, fine",kg', "piece").rows
        expect(row).toMatchObject({ name: "Salt, fine", unit: "kg" })
    })
    it("skips a row without a name", async () => {
        const subject = await buildSubject()

        const text = "SKU,Name\nA1,\nB2,Pepper"

        expect(subject.parseItemTable(text, "piece")).toEqual({
            rows: [expect.objectContaining({ sku: "B2", name: "Pepper" })],
            skipped: ["A1,"],
        })
    })

    it("answers nothing for an empty text", async () => {
        const subject = await buildSubject()

        expect(subject.parseItemTable("  \n\n", "piece")).toEqual({ rows: [], skipped: [] })
    })

    it("clamps negative numbers to zero", async () => {
        const subject = await buildSubject()

        const [row] = subject.parseItemTable("A1,Rice,kg,Grain,-5,-1,-2,-3", "piece").rows

        expect(row).toMatchObject({ costVnd: 0, sellPriceVnd: 0, reorderPoint: 0, reorderQty: 0 })
    })
})

describe("skuFromName", () => {
    it("takes the first four words, upper case and dashed", async () => {
        const subject = await buildSubject()

        expect(subject.skuFromName("green tea leaves for the shop")).toBe("GREEN-TEA-LEAVES-FOR")
    })

    it("cuts a long result to 24 characters", async () => {
        const subject = await buildSubject()

        expect(subject.skuFromName("aaaaaaaaaaaa bbbbbbbbbbbb cccccccccccc")).toBe("AAAAAAAAAAAA-BBBBBBBBBBB")
    })

    it("falls back to a fixed code for a name with no letters", async () => {
        const subject = await buildSubject()

        expect(subject.skuFromName("---")).toBe("ITEM")
    })
})
