import type * as SubjectModule from "./contract-import.policy"
import { Test } from "@nestjs/testing"
import type { Table } from "@modules/integrations/data-sources"
import type { ContractImportMapping, ContractImportRow } from "./contract-import.contracts"
import {
    contractKey,
    importStatus,
    mappingOf,
    parseImportDay,
    readContractRows,
    skipReason,
    suggestContractMapping,
    yearBefore,
} from "./contract-import.policy"
import { CONTRACT_IMPORT_COPY } from "./messages/contract-import.messages"

const SUBJECT = Symbol("contract-import.policy")
type Subject = typeof SubjectModule

const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    contractKey,
                    importStatus,
                    mappingOf,
                    parseImportDay,
                    readContractRows,
                    skipReason,
                    suggestContractMapping,
                    yearBefore,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const TODAY = "2026-10-27"

const HEADERS = [
    "Kh\u00e1ch h\u00e0ng",
    "T\u00ean d\u1ef1 \u00e1n/t\u00ean website",
    "Th\u1eddi gian b\u1eaft \u0111\u1ea7u",
    "Ng\u00e0y h\u1ebft h\u1ea1n",
    "Gi\u00e1 tr\u1ecb",
    "Tr\u1ea1ng th\u00e1i",
    "Ghi ch\u00fa",
]

const MAPPING: ContractImportMapping = {
    customerName: "Kh\u00e1ch h\u00e0ng",
    plan: "T\u00ean d\u1ef1 \u00e1n/t\u00ean website",
    startsOn: "Th\u1eddi gian b\u1eaft \u0111\u1ea7u",
    endsOn: "Ng\u00e0y h\u1ebft h\u1ea1n",
    amountVnd: "Gi\u00e1 tr\u1ecb",
    status: "Tr\u1ea1ng th\u00e1i",
    note: "Ghi ch\u00fa",
}

const tableOf = (rows: ReadonlyArray<ReadonlyArray<string>>): Table => ({
    headers: HEADERS,
    rows,
    delimiter: ",",
    sheets: [],
    sheet: "",
})

const firstRow = async (
    cells: ReadonlyArray<string>,
    existing: ReadonlySet<string> = new Set(),
): Promise<ContractImportRow | undefined> => {
    const subject = await buildSubject()
    return subject.readContractRows(tableOf([cells]), MAPPING, TODAY, existing)[0]
}

describe("suggestContractMapping", () => {
    it("maps the Vietnamese headers of a contract sheet to every field", async () => {
        const subject = await buildSubject()
        expect(subject.suggestContractMapping(HEADERS)).toEqual(MAPPING)
    })

    it("maps the other Vietnamese spellings: customer name, plan, start and end time, amount", async () => {
        const subject = await buildSubject()
        expect(
            subject.suggestContractMapping([
                "T\u00ean kh\u00e1ch h\u00e0ng",
                "G\u00f3i",
                "Th\u1eddi gian k\u1ebft th\u00fac",
                "S\u1ed1 ti\u1ec1n",
                "Th\u1eddi gian b\u1eaft \u0111\u1ea7u",
            ]),
        ).toEqual({
            customerName: "T\u00ean kh\u00e1ch h\u00e0ng",
            plan: "G\u00f3i",
            startsOn: "Th\u1eddi gian b\u1eaft \u0111\u1ea7u",
            endsOn: "Th\u1eddi gian k\u1ebft th\u00fac",
            amountVnd: "S\u1ed1 ti\u1ec1n",
            status: null,
            note: null,
        })
    })

    it("maps English headers and leaves a field without a column null", async () => {
        const subject = await buildSubject()
        expect(
            subject.suggestContractMapping(["Customer", "Plan", "Start date", "End date", "Amount", "Status", "Notes"]),
        ).toEqual({
            customerName: "Customer",
            plan: "Plan",
            startsOn: "Start date",
            endsOn: "End date",
            amountVnd: "Amount",
            status: "Status",
            note: "Notes",
        })
        expect(subject.suggestContractMapping(["Customer", "Expiry"]).startsOn).toBeNull()
    })

    it("never gives one column to two fields", async () => {
        const subject = await buildSubject()
        const mapping = subject.suggestContractMapping(["Kh\u00e1ch h\u00e0ng"])
        expect(mapping.customerName).toBe("Kh\u00e1ch h\u00e0ng")
        expect(Object.values(mapping).filter((value) => value !== null)).toHaveLength(1)
    })
})

describe("mappingOf", () => {
    it("keeps only columns the table has", async () => {
        const subject = await buildSubject()
        expect(subject.mappingOf({ customerName: "Kh\u00e1ch h\u00e0ng", endsOn: "Gone" }, HEADERS)).toEqual({
            customerName: "Kh\u00e1ch h\u00e0ng",
            plan: null,
            startsOn: null,
            endsOn: null,
            amountVnd: null,
            status: null,
            note: null,
        })
        expect(subject.mappingOf(null, HEADERS).customerName).toBeNull()
    })
})

describe("parseImportDay", () => {
    it("reads YYYY-MM-DD, with or without a time after it", async () => {
        const subject = await buildSubject()
        expect(subject.parseImportDay("2026-03-05")).toBe("2026-03-05")
        expect(subject.parseImportDay("2026-3-5")).toBe("2026-03-05")
        expect(subject.parseImportDay("2026-03-05T00:00:00.000Z")).toBe("2026-03-05")
    })

    it("reads DD/MM/YYYY as day first", async () => {
        const subject = await buildSubject()
        expect(subject.parseImportDay("05/03/2026")).toBe("2026-03-05")
        expect(subject.parseImportDay("5-3-2026")).toBe("2026-03-05")
        expect(subject.parseImportDay("31.12.2025")).toBe("2025-12-31")
    })

    it("reads an Excel serial day number", async () => {
        const subject = await buildSubject()
        expect(subject.parseImportDay("45658")).toBe("2025-01-01")
        expect(subject.parseImportDay("45658.5")).toBe("2025-01-01")
    })

    it("answers undefined for an empty cell and null for one it cannot read", async () => {
        const subject = await buildSubject()
        expect(subject.parseImportDay("  ")).toBeUndefined()
        expect(subject.parseImportDay("31/02/2026")).toBeNull()
        expect(subject.parseImportDay("2026-13-01")).toBeNull()
        expect(subject.parseImportDay("next year")).toBeNull()
        expect(subject.parseImportDay("0")).toBeNull()
    })
})

describe("yearBefore", () => {
    it("goes back one calendar year, 29 February landing on 28 February", async () => {
        const subject = await buildSubject()
        expect(subject.yearBefore("2027-03-15")).toBe("2026-03-15")
        expect(subject.yearBefore("2028-02-29")).toBe("2027-02-28")
    })

    it("hands back a day it cannot read", async () => {
        const subject = await buildSubject()
        expect(subject.yearBefore("not-a-day")).toBe("not-a-day")
    })
})

describe("importStatus", () => {
    it("maps a cancelled word to cancelled whatever the end day", async () => {
        const subject = await buildSubject()
        expect(subject.importStatus("\u0110\u00e3 h\u1ee7y", "2030-01-01", TODAY)).toBe("cancelled")
        expect(subject.importStatus("Cancelled", "2020-01-01", TODAY)).toBe("cancelled")
    })

    it("marks a past end day ended unless the sheet says it is active", async () => {
        const subject = await buildSubject()
        expect(subject.importStatus("", "2025-01-01", TODAY)).toBe("ended")
        expect(subject.importStatus("H\u1ebft h\u1ea1n", "2025-01-01", TODAY)).toBe("ended")
        expect(subject.importStatus("Ho\u1ea1t \u0111\u1ed9ng", "2025-01-01", TODAY)).toBe("active")
    })

    it("keeps a contract that has not ended active", async () => {
        const subject = await buildSubject()
        expect(subject.importStatus("", "2027-01-01", TODAY)).toBe("active")
        expect(subject.importStatus("", TODAY, TODAY)).toBe("active")
        expect(subject.importStatus("", null, TODAY)).toBe("active")
    })
})

describe("readContractRows", () => {
    it("reads a full row with its number in the sheet, the amount in whole dong and no problem", async () => {
        await expect(
            firstRow(["Anh Minh", "minh.vn", "01/01/2026", "2027-01-01", "1.200.000", "", "Gia h\u1ea1n"]),
        ).resolves.toEqual({
            row: 2,
            customerName: "Anh Minh",
            plan: "minh.vn",
            startsOn: "2026-01-01",
            endsOn: "2027-01-01",
            amountVnd: 1_200_000,
            status: "active",
            note: "Gia h\u1ea1n",
            problems: [],
        })
    })

    it("derives a missing start as the end minus one year and flags it in the note", async () => {
        const subject = await buildSubject()
        const row = await firstRow(["Anh Minh", "minh.vn", "", "2027-01-01", "", "", "SSL"])
        expect(row?.startsOn).toBe("2026-01-01")
        expect(row?.amountVnd).toBeNull()
        expect(row?.note).toBe(`SSL ${CONTRACT_IMPORT_COPY.derivedStart}`)
        expect(row?.problems).toEqual(["startsOnDerived"])
        expect(row === undefined ? "absent" : subject.skipReason(row)).toBeNull()
    })

    it("reads the cells a short row lacks as empty", async () => {
        const row = await firstRow(["Anh Minh", "minh.vn", "", "2027-01-01"])
        expect(row?.amountVnd).toBeNull()
        expect(row?.note).toBe(CONTRACT_IMPORT_COPY.derivedStart)
        expect(row?.problems).toEqual(["startsOnDerived"])
    })

    it("flags the rows that cannot be saved", async () => {
        expect((await firstRow(["", "x", "", "2027-01-01", "", "", ""]))?.problems).toContain("customerMissing")
        expect((await firstRow(["A", "x", "2026-01-01", "", "", "", ""]))?.problems).toEqual(["endsOnMissing"])
        expect((await firstRow(["A", "x", "", "soon", "", "", ""]))?.problems).toEqual(["endsOnInvalid"])
        expect((await firstRow(["A", "x", "later", "2027-01-01", "", "", ""]))?.problems).toEqual(["startsOnInvalid"])
        expect((await firstRow(["A", "x", "2027-02-01", "2027-01-01", "", "", ""]))?.problems).toEqual([
            "datesReversed",
        ])
        expect((await firstRow(["A", "x", "2026-01-01", "2027-01-01", "free", "", ""]))?.problems).toEqual([
            "amountInvalid",
        ])
    })

    it("judges the status with the end day and leaves unmapped fields empty", async () => {
        const subject = await buildSubject()
        const [row] = subject.readContractRows(
            tableOf([["Ch\u1ecb Lan", "lan.vn", "2024-01-01", "2025-01-01", "", "", ""]]),
            { ...MAPPING, plan: null },
            TODAY,
            new Set(),
        )
        expect(row?.plan).toBe("")
        expect(row?.status).toBe("ended")
    })
})

describe("readContractRows duplicates", () => {
    it("flags a contract the workspace already has, compared without case or accents", async () => {
        const subject = await buildSubject()
        const existing = new Set([subject.contractKey("Anh Minh", "minh.vn", "2027-01-01")])
        const row = await firstRow(["anh minh", "MINH.VN", "2026-01-01", "01/01/2027", "", "", ""], existing)
        expect(row?.problems).toEqual(["duplicate"])
        expect(row === undefined ? null : subject.skipReason(row)).toBe("duplicate")
    })

    it("flags a row repeating an earlier row of the same file", async () => {
        const subject = await buildSubject()
        const rows = subject.readContractRows(
            tableOf([
                ["Anh Minh", "minh.vn", "2026-01-01", "2027-01-01", "", "", ""],
                ["Anh Minh", "minh.vn", "2026-01-01", "2027-01-01", "", "", ""],
                ["Anh Minh", "minh.vn", "2027-01-01", "2028-01-01", "", "", ""],
            ]),
            MAPPING,
            TODAY,
            new Set(),
        )
        expect(rows.map((row) => row.problems)).toEqual([[], ["duplicate"], []])
        expect(rows.map((row) => row.row)).toEqual([2, 3, 4])
    })
})
