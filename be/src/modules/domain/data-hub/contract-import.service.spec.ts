import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ContractsService } from "@modules/domain/contracts"
import type { ContractResult } from "@modules/domain/contracts"
import type { Table, TableClient } from "@modules/integrations/data-sources"
import { TABLE } from "@modules/integrations/data-sources"
import { CLOCK } from "@modules/platform/clock"
import { DomainError } from "@modules/platform/errors"
import type { ContractImportRequest } from "./contract-import.contracts"
import * as importPolicy from "./contract-import.policy"
import { CONTRACT_IMPORT_MAX_ROWS, ContractImportService } from "./contract-import.service"
import { DataHubErrorCode } from "./errors/data-hub.error"
import { CONTRACT_IMPORT_COPY } from "./messages/contract-import.messages"
import { CSV_COPY } from "./messages/csv-import.messages"

class RefusedContract extends DomainError<"CONTRACTS_DATE_INVALID"> {}

const NOW = new Date("2026-10-27T03:00:00.000Z")

const HEADERS = ["Kh\u00e1ch h\u00e0ng", "G\u00f3i", "Ng\u00e0y h\u1ebft h\u1ea1n", "Gi\u00e1 tr\u1ecb"]

const source: Table = {
    headers: HEADERS,
    rows: [
        ["Anh Minh", "Hosting", "2027-01-01", "1.000.000"],
        ["Ch\u1ecb Lan", "SSL", "", ""],
        ["C\u00f4 Hoa", "Domain", "01/03/2025", ""],
        ["Anh T\u00fa", "Hosting", "2027-05-01", ""],
    ],
    delimiter: ",",
    sheets: [],
    sheet: "",
}

const existing: ContractResult = {
    id: "contract-1",
    leadId: null,
    customerName: "Anh T\u00fa",
    plan: "hosting",
    startsOn: "2026-05-01",
    endsOn: "2027-05-01",
    amountVnd: null,
    status: "active",
    note: "",
}

const request: ContractImportRequest = {
    workspaceId: "ws-1",
    userId: "user-1",
    text: "pasted",
    mapping: {
        customerName: "Kh\u00e1ch h\u00e0ng",
        plan: "G\u00f3i",
        endsOn: "Ng\u00e0y h\u1ebft h\u1ea1n",
        amountVnd: "Gi\u00e1 tr\u1ecb",
    },
    acceptLanguage: "vi",
}

const LINKED = {
    linked: 2,
    created: 1,
    unmatched: [{ contractId: "new", customerName: "C\u00f4 Hoa", reason: "noCustomer" as const }],
}

const build = async () => {
    const contracts = mock<ContractsService>()
    const table = mock<TableClient>()
    contracts.list.mockResolvedValue([existing])
    contracts.saveContract.mockImplementation((params) =>
        Promise.resolve({ ...existing, id: "new", customerName: params.customerName }),
    )
    contracts.linkCustomers.mockResolvedValue(LINKED)
    table.readText.mockReturnValue(source)
    table.readFile.mockResolvedValue({
        ...source,
        sheets: ["H\u1ee3p \u0111\u1ed3ng"],
        sheet: "H\u1ee3p \u0111\u1ed3ng",
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContractImportService,
            { provide: ContractsService, useValue: contracts },
            { provide: TABLE, useValue: table },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { service: moduleRef.get(ContractImportService), contracts, table }
}

const invalidWith = (detail: string): unknown =>
    expect.objectContaining({ code: DataHubErrorCode.Invalid, params: { detail } })

describe("ContractImportService.preview", () => {
    it("suggests a mapping, judges the rows against the workspace contracts and counts the ready ones", async () => {
        const { service, contracts, table } = await build()

        const preview = await service.preview({ workspaceId: "ws-1", userId: "user-1", text: "pasted" })

        expect(contracts.list).toHaveBeenCalledWith("ws-1", "user-1")
        expect(table.readText).toHaveBeenCalledWith("pasted")
        expect(preview.mapping).toEqual({
            customerName: "Kh\u00e1ch h\u00e0ng",
            plan: "G\u00f3i",
            startsOn: null,
            endsOn: "Ng\u00e0y h\u1ebft h\u1ea1n",
            amountVnd: "Gi\u00e1 tr\u1ecb",
            status: null,
            note: null,
        })
        expect(preview.total).toBe(4)
        expect(preview.ready).toBe(2)
        expect(preview.rows.map((row) => row.problems)).toEqual([
            ["startsOnDerived"],
            ["endsOnMissing"],
            ["startsOnDerived"],
            ["startsOnDerived", "duplicate"],
        ])
        expect(preview.rows[2]?.status).toBe("ended")
    })

    it("judges the rows with the mapping the person chose and reads the named tab of an uploaded file", async () => {
        const { service, table } = await build()

        const preview = await service.preview({
            workspaceId: "ws-1",
            userId: "user-1",
            file: { name: "hop-dong.xlsx", contentBase64: Buffer.from("PK").toString("base64") },
            sheet: "H\u1ee3p \u0111\u1ed3ng",
            mapping: { customerName: "G\u00f3i", endsOn: "Ng\u00e0y h\u1ebft h\u1ea1n" },
        })

        expect(table.readFile).toHaveBeenCalledWith("hop-dong.xlsx", expect.any(Uint8Array), "H\u1ee3p \u0111\u1ed3ng")
        expect(preview.sheet).toBe("H\u1ee3p \u0111\u1ed3ng")
        expect(preview.mapping.customerName).toBe("G\u00f3i")
        expect(preview.rows[0]?.customerName).toBe("Hosting")
    })

    it("reads the first tab of an uploaded file when no tab is named", async () => {
        const { service, table } = await build()

        await service.preview({
            workspaceId: "ws-1",
            userId: "user-1",
            file: { name: "hop-dong.xlsx", contentBase64: Buffer.from("PK").toString("base64") },
            sheet: null,
        })

        expect(table.readFile).toHaveBeenCalledWith("hop-dong.xlsx", expect.any(Uint8Array), undefined)
    })

    it("refuses a request with neither a file nor pasted text", async () => {
        const { service } = await build()

        await expect(service.preview({ workspaceId: "ws-1", userId: "user-1", text: "  " })).rejects.toEqual(
            invalidWith(CONTRACT_IMPORT_COPY.chooseSource),
        )
    })

    it("refuses a file over ten megabytes", async () => {
        const { service } = await build()
        const big = Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64")

        await expect(
            service.preview({ workspaceId: "ws-1", userId: "user-1", file: { name: "a.csv", contentBase64: big } }),
        ).rejects.toEqual(invalidWith(CSV_COPY.textTooLarge))
    })
})

describe("ContractImportService.importContracts", () => {
    {
        it("saves each valid row through the contracts capability, skips the rest with a reason and links the customers", async () => {
            const { service, contracts } = await build()

            await expect(service.importContracts(request)).resolves.toEqual({
                created: 2,
                skipped: [
                    { row: 3, reason: "endsOnMissing" },
                    { row: 5, reason: "duplicate" },
                ],
                customers: LINKED,
            })
            expect(contracts.linkCustomers).toHaveBeenCalledWith("ws-1")
            expect(contracts.linkCustomers.mock.invocationCallOrder[0]).toBeGreaterThan(
                contracts.saveContract.mock.invocationCallOrder[1] ?? Number.MAX_SAFE_INTEGER,
            )
            expect(contracts.saveContract).toHaveBeenCalledTimes(2)
            expect(contracts.saveContract).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                userId: "user-1",
                acceptLanguage: "vi",
                contractId: null,
                leadId: null,
                customerName: "Anh Minh",
                plan: "Hosting",
                startsOn: "2026-01-01",
                endsOn: "2027-01-01",
                amountVnd: 1_000_000,
                status: "active",
                note: CONTRACT_IMPORT_COPY.derivedStart,
            })
            expect(contracts.saveContract).toHaveBeenCalledWith(
                expect.objectContaining({ customerName: "C\u00f4 Hoa", startsOn: "2024-03-01", status: "ended" }),
            )
        })

        it("skips a row the contracts capability refuses with its code and goes on", async () => {
            const { service, contracts } = await build()
            contracts.saveContract.mockRejectedValueOnce(new RefusedContract({ code: "CONTRACTS_DATE_INVALID" }))

            const result = await service.importContracts(request)

            expect(result.created).toBe(1)
            expect(result.skipped).toContainEqual({ row: 2, reason: "CONTRACTS_DATE_INVALID" })
        })

        it("skips a row without an end day as missing even when the policy named no problem", async () => {
            const { service, contracts } = await build()
            const skipReason = jest.spyOn(importPolicy, "skipReason").mockReturnValue(null)

            const result = await service.importContracts(request)
            skipReason.mockRestore()

            expect(result.skipped).toEqual([{ row: 3, reason: "endsOnMissing" }])
            expect(result.created).toBe(3)
            expect(contracts.saveContract).toHaveBeenCalledTimes(3)
        })

        it("lets an unexpected failure through", async () => {
            const { service, contracts } = await build()
            contracts.saveContract.mockRejectedValueOnce(new Error("database down"))

            await expect(service.importContracts(request)).rejects.toThrow("database down")
            expect(contracts.linkCustomers).not.toHaveBeenCalled()
        })
    }
})

describe("ContractImportService.importContracts refusals", () => {
    {
        it("refuses a mapping without the customer or the end day column", async () => {
            const { service, contracts } = await build()

            await expect(
                service.importContracts({
                    ...request,
                    mapping: { customerName: "Kh\u00e1ch h\u00e0ng", endsOn: "Gone" },
                }),
            ).rejects.toEqual(invalidWith(CONTRACT_IMPORT_COPY.chooseColumns))
            expect(contracts.saveContract).not.toHaveBeenCalled()
        })

        it("refuses more rows than one import takes", async () => {
            const { service, table } = await build()
            const row = ["Anh Minh", "Hosting", "2027-01-01", ""]
            table.readText.mockReturnValue({
                ...source,
                rows: Array.from({ length: CONTRACT_IMPORT_MAX_ROWS + 1 }, () => row),
            })

            await expect(service.importContracts(request)).rejects.toEqual(
                invalidWith(CONTRACT_IMPORT_COPY.tooManyRows(CONTRACT_IMPORT_MAX_ROWS)),
            )
        })

        it("lets a refused membership through before reading anything", async () => {
            const { service, contracts, table } = await build()
            contracts.list.mockRejectedValue(new RefusedContract({ code: "CONTRACTS_DATE_INVALID" }))

            await expect(service.importContracts(request)).rejects.toBeInstanceOf(RefusedContract)
            expect(table.readText).not.toHaveBeenCalled()
        })
    }
})
