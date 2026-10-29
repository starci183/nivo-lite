import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { tt78Xml } from "@tests/fixtures/builders/einvoice.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { McpGatewayErrorCode } from "../errors/mcp-gateway.error"
import { EINVOICE_MANIFEST, EinvoiceNativeService } from "./einvoice-native.service"

const MAIL = {
    id: "rec-1",
    attachments: [{ name: "logo.png" }, { xml: tt78Xml() }, { xml: "<not-an-invoice/>" }, "x", { xml: "" }],
}

const build = async (entityManager: MockEntityManager): Promise<EinvoiceNativeService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [EinvoiceNativeService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(EinvoiceNativeService)
}

describe("EinvoiceNativeService.list", () => {
    it("lists the TT78 invoices of the mails with their summary and the reader's draft", async () => {
        const em = mockEntityManager()
        const [mails] = queueQueryBuilders(em, [{ getRawMany: [MAIL, { id: "rec-2", attachments: null }] }])
        const einvoice = await build(em)

        const listed = await einvoice.invoke("ws-1", "list", { since: "2026-10-01", limit: 5 })

        expect(listed).toMatchObject({
            invoices: [
                {
                    id: "rec-1:1",
                    sellerTaxCode: "0100109106",
                    sellerName: "Cong ty TNHH Linh An",
                    number: "17",
                    series: "C26TLA",
                    issuedOn: "2026-10-19",
                    totalVnd: 4400000,
                    vatVnd: 200000,
                    format: "xml",
                    draft: { source: "xml", invoiceNo: "17", lines: [{ quantity: 20 }, { quantity: 10 }] },
                },
            ],
        })
        expect(mails?.callsOf("from")).toEqual([["public.data_records", "r"]])
        expect(mails?.callsOf("where")).toEqual([
            ["r.workspace_id = :workspaceId AND r.entity = 'message'", { workspaceId: "ws-1" }],
        ])
        expect(mails?.callsOf("andWhere")).toEqual([
            [
                "jsonb_path_exists(r.data, CAST(:attachmentsPath AS jsonpath))",
                { attachmentsPath: "$.attachments[*].xml" },
            ],
            ["r.occurred_at >= CAST(:since AS date)", { since: "2026-10-01" }],
        ])
        expect(mails?.callsOf("orderBy")).toEqual([["r.occurred_at", "DESC", "NULLS LAST"]])
        expect(mails?.callsOf("limit")).toEqual([[200]])
        expect(einvoice.manifest).toBe(EINVOICE_MANIFEST)
        expect(EINVOICE_MANIFEST.tools[0]?.inputSchema).toMatchObject({
            properties: {
                since: { type: "string", minLength: 10, maxLength: 10, format: "date" },
                limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
            },
            additionalProperties: false,
        })
    })

    it("defaults an omitted date and limit, and honors the supplied count", async () => {
        const many = { id: "rec-3", attachments: [{ xml: tt78Xml() }, { xml: tt78Xml({ SHDon: "18" }) }] }
        const em = mockEntityManager()
        const fakes = queueQueryBuilders(em, [{ getRawMany: [many] }, { getRawMany: [many] }])
        const einvoice = await build(em)

        await expect(einvoice.invoke("ws-1", "list", {})).resolves.toMatchObject({
            invoices: [{ id: "rec-3:0" }, { id: "rec-3:1" }],
        })
        await expect(einvoice.invoke("ws-1", "list", { limit: 1 })).resolves.toMatchObject({
            invoices: [{ id: "rec-3:0" }],
        })
        for (const fake of fakes) {
            expect(fake.callsOf("andWhere").map(([condition]) => condition)).toEqual([
                "jsonb_path_exists(r.data, CAST(:attachmentsPath AS jsonpath))",
            ])
        }
    })

    it.each([{ since: "19/10/2026" }, { limit: 0 }, { limit: 51 }, { limit: 1.5 }, { limit: "5" }])(
        "refuses invalid arguments before reading the mailbox: %p",
        async (args) => {
            const em = mockEntityManager()
            const einvoice = await build(em)

            await expect(einvoice.invoke("ws-1", "list", args)).rejects.toMatchObject({
                code: McpGatewayErrorCode.InvalidArguments,
                params: { tool: "list" },
            })
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        },
    )
})

describe("EinvoiceNativeService.get", () => {
    it("answers one invoice with its lines, unit prices and VAT rates", async () => {
        const em = mockEntityManager()
        const [mails] = queueQueryBuilders(em, [{ getRawMany: [MAIL] }])
        const einvoice = await build(em)

        await expect(einvoice.invoke("ws-1", "get", { id: "rec-1:1" })).resolves.toEqual({
            found: true,
            id: "rec-1:1",
            seller: { taxCode: "0100109106", name: "Cong ty TNHH Linh An" },
            buyer: { taxCode: "0108896128", name: "HAKUEN Hotel & Spa" },
            number: "17",
            series: "C26TLA",
            issuedOn: "2026-10-19",
            lines: [
                { name: "Khan tam cotton", qty: 20, unitPriceVnd: 100000, vatRate: "10%", amountVnd: 2000000 },
                { name: "Dau massage <thao moc>", qty: 10, unitPriceVnd: 220000, vatRate: "KCT", amountVnd: 2200000 },
            ],
            subtotalVnd: 4200000,
            totalVnd: 4400000,
            vatVnd: 200000,
        })
        expect(mails?.callsOf("andWhere")).toEqual([["CAST(r.id AS text) = :recordId", { recordId: "rec-1" }]])
        expect(mails?.callsOf("limit")).toEqual([[1]])
        expect(EINVOICE_MANIFEST.tools[1]?.inputSchema).toMatchObject({
            properties: { id: { type: "string", minLength: 1, maxLength: 200 } },
            required: ["id"],
            additionalProperties: false,
        })
    })

    it("answers a zero unit price for a line without quantity", async () => {
        const xml = tt78Xml().replace("<SLuong>20</SLuong>", "<SLuong>0</SLuong>")
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawMany: [{ id: "rec-4", attachments: [{ xml }] }] }])
        const einvoice = await build(em)

        await expect(einvoice.invoke("ws-1", "get", { id: "rec-4:0" })).resolves.toMatchObject({
            lines: [{ qty: 0, unitPriceVnd: 0 }, { qty: 10 }],
        })
    })

    it("answers not found for an id no mail holds", async () => {
        const em = mockEntityManager()
        const [, second] = queueQueryBuilders(em, [{ getRawMany: [MAIL] }, { getRawMany: [] }])
        const einvoice = await build(em)

        await expect(einvoice.invoke("ws-1", "get", { id: "rec-1:7" })).resolves.toEqual({ found: false })
        await expect(einvoice.invoke("ws-1", "get", { id: "rec-2:0" })).resolves.toEqual({ found: false })
        expect(second?.callsOf("andWhere")).toEqual([["CAST(r.id AS text) = :recordId", { recordId: "rec-2" }]])
    })

    it.each([{}, { id: 7 }, { id: "" }, { id: "a".repeat(201) }])(
        "refuses an invalid identifier before reading the mailbox: %p",
        async (args) => {
            const em = mockEntityManager()
            const einvoice = await build(em)

            await expect(einvoice.invoke("ws-1", "get", args)).rejects.toMatchObject({
                code: McpGatewayErrorCode.InvalidArguments,
                params: { tool: "get" },
            })
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        },
    )

    it("refuses a tool the connector does not have", async () => {
        const einvoice = await build(mockEntityManager())

        await expect(einvoice.invoke("ws-1", "delete", {})).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
        })
    })
})
