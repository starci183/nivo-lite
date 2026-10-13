import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AutomationExtensionsService } from "@modules/domain/automations"
import type { ExecutorContext } from "@modules/domain/automations"
import { WorkspacesService } from "@modules/domain/workspaces"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { buildPipelineRow, buildShop, buildTemplate } from "@tests/fixtures/builders/automations.builder"
import { GoogleConnectionsService } from "./google-connections.service"
import { GoogleSheetAutomationService } from "./google-sheet-automation.service"

const NOW = new Date("2026-10-12T03:00:00.000Z")
const sheetDef = buildTemplate({ key: "sheet_orders" })
const context: ExecutorContext = {
    workspaceId: "ws-1",
    pipeline: buildPipelineRow({ template_key: "sheet_orders" }),
    def: sheetDef,
    config: { spreadsheetId: "sheet-1", recordOrders: true },
    body: "",
    shop: buildShop(),
}

const build = async () => {
    const extensions = mock<AutomationExtensionsService>()
    const google = mock<GoogleConnectionsService>()
    google.accountsOf.mockResolvedValue([{ id: "g1", email: "shop@example.test", status: "connected" }])
    google.provisionOrdersSheet.mockResolvedValue({
        spreadsheetId: "sheet-new",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-new/edit",
    })
    google.runSheetEvent.mockResolvedValue({ evidence: "Row 2" })
    const workspaces = mock<WorkspacesService>()
    workspaces.nameOf.mockResolvedValue("Lan Shop")
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}${JSON.stringify(params)}`)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GoogleSheetAutomationService,
            { provide: AutomationExtensionsService, useValue: extensions },
            { provide: GoogleConnectionsService, useValue: google },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { service: moduleRef.get(GoogleSheetAutomationService), extensions, google, workspaces }
}

describe("GoogleSheetAutomationService", () => {
    it("registers the sheet executor, the switch-on hook and the Google accounts at boot", async () => {
        const { service, extensions } = await build()

        service.onModuleInit()
        const extension = extensions.add.mock.calls[0]?.[0]
        expect(extension?.executors?.sheet_orders).toBeDefined()
        await expect(extension?.googleAccounts?.("ws-1")).resolves.toEqual([
            { id: "g1", email: "shop@example.test", status: "connected" },
        ])
    })

    describe("record", () => {
        it("writes the event and answers a done run with its evidence", async () => {
            const { service, google } = await build()

            const result = await service.record(context, {
                event: "order.confirmed",
                data: { order_no: "DH-1" },
                at: "2026-10-12T02:00:00.000Z",
            })
            expect(google.runSheetEvent).toHaveBeenCalledWith("ws-1", context.config, {
                event: "order.confirmed",
                data: { order_no: "DH-1" },
                occurredAt: "2026-10-12T02:00:00.000Z",
            })
            expect(result.status).toBe("done")
            expect(result.evidence).toBe("Row 2")
        })

        it("answers a skipped run when the kind of event is switched off", async () => {
            const { service, google } = await build()
            google.runSheetEvent.mockResolvedValue({ evidence: "Leads off", skipped: true })

            const result = await service.record(context, { event: "lead.created", data: {}, at: NOW })
            expect(result.status).toBe("skipped")
            expect(google.runSheetEvent).toHaveBeenCalledWith(
                "ws-1",
                context.config,
                expect.objectContaining({ occurredAt: NOW.toISOString() }),
            )
        })

        it("skips an event the sheet does not record without calling Google", async () => {
            const { service, google } = await build()

            await expect(service.record(context, { event: "order.shipped" })).resolves.toMatchObject({
                status: "skipped",
            })
            expect(google.runSheetEvent).not.toHaveBeenCalled()
        })
    })

    describe("prepareEnable", () => {
        it("creates the spreadsheet named after the shop and keeps its id and link", async () => {
            const { service, google } = await build()

            await expect(service.prepareEnable("ws-1", sheetDef, { recordOrders: true })).resolves.toEqual({
                recordOrders: true,
                spreadsheetId: "sheet-new",
                sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-new/edit",
            })
            expect(google.provisionOrdersSheet).toHaveBeenCalledWith(
                "ws-1",
                'googleConnections.sheetTitle{"name":"Lan Shop"}',
                { recordOrders: true },
            )
        })

        it("leaves another template and an existing spreadsheet untouched", async () => {
            const { service, google } = await build()

            await expect(
                service.prepareEnable("ws-1", buildTemplate({ key: "thank_payment" }), { a: 1 }),
            ).resolves.toEqual({ a: 1 })
            await expect(service.prepareEnable("ws-1", sheetDef, { spreadsheetId: "s1" })).resolves.toEqual({
                spreadsheetId: "s1",
            })
            expect(google.provisionOrdersSheet).not.toHaveBeenCalled()
        })
    })
})
