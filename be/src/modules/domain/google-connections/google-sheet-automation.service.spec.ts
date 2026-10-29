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
import { GoogleSheetsService } from "./google-sheets.service"

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
    const sheets = mock<GoogleSheetsService>()
    sheets.provisionOrdersSheet.mockResolvedValue({
        spreadsheetId: "sheet-new",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-new/edit",
    })
    sheets.runSheetEvent.mockResolvedValue({ evidence: "Row 2" })
    const workspaces = mock<WorkspacesService>()
    workspaces.nameOf.mockResolvedValue("Lan Shop")
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}${JSON.stringify(params)}`)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GoogleSheetAutomationService,
            { provide: AutomationExtensionsService, useValue: extensions },
            { provide: GoogleConnectionsService, useValue: google },
            { provide: GoogleSheetsService, useValue: sheets },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { service: moduleRef.get(GoogleSheetAutomationService), extensions, sheets, workspaces }
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

    it("runs the executor and switch-on hook registered with the engine", async () => {
        const { service, extensions, sheets } = await build()
        service.onModuleInit()
        const extension = extensions.add.mock.calls[0]?.[0]

        await expect(extension?.executors?.sheet_orders?.(context, { event: "payment.received" })).resolves.toEqual({
            status: "done",
            steps: [{ label: "googleConnections.sheetOrders.written{}", status: "done", detail: "Row 2" }],
            evidence: "Row 2",
        })
        expect(sheets.runSheetEvent).toHaveBeenCalledWith("ws-1", context.config, {
            event: "payment.received",
            data: {},
            occurredAt: NOW.toISOString(),
        })
        await expect(extension?.prepareEnable?.("ws-1", "owner-1", sheetDef, { recordOrders: true })).resolves.toEqual({
            recordOrders: true,
            spreadsheetId: "sheet-new",
            sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-new/edit",
        })
        expect(sheets.provisionOrdersSheet).toHaveBeenCalledWith(
            "ws-1",
            'googleConnections.sheetTitle{"name":"Lan Shop"}',
            { recordOrders: true },
        )
    })
})

describe("GoogleSheetAutomationService / record", () => {
    it("writes the event and answers a done run with its evidence", async () => {
        const { service, sheets } = await build()

        const result = await service.record(context, {
            event: "order.confirmed",
            data: { order_no: "DH-1" },
            at: "2026-10-12T02:00:00.000Z",
        })
        expect(sheets.runSheetEvent).toHaveBeenCalledWith("ws-1", context.config, {
            event: "order.confirmed",
            data: { order_no: "DH-1" },
            occurredAt: "2026-10-12T02:00:00.000Z",
        })
        expect(result.status).toBe("done")
        expect(result.evidence).toBe("Row 2")
    })

    it("answers a skipped run when the kind of event is switched off", async () => {
        const { service, sheets } = await build()
        sheets.runSheetEvent.mockResolvedValue({ evidence: "Leads off", skipped: true })

        const result = await service.record(context, { event: "lead.created", data: {}, at: NOW })
        expect(result.status).toBe("skipped")
        expect(result).toEqual({
            status: "skipped",
            steps: [
                {
                    label: "googleConnections.sheetOrders.skipped{}",
                    status: "skipped",
                    detail: "googleConnections.sheetOrders.skippedDetail{}",
                },
            ],
            evidence: "Leads off",
        })
        expect(sheets.runSheetEvent).toHaveBeenCalledWith(
            "ws-1",
            context.config,
            expect.objectContaining({ occurredAt: NOW.toISOString() }),
        )
    })

    it("skips an event the sheet does not record without calling Google", async () => {
        const { service, sheets } = await build()

        await expect(service.record(context, { event: "order.shipped" })).resolves.toMatchObject({
            status: "skipped",
        })
        expect(sheets.runSheetEvent).not.toHaveBeenCalled()
    })

    it.each([undefined, null, 17])("skips a non-string event: %s", async (event) => {
        const { service, sheets } = await build()

        await expect(service.record(context, { event })).resolves.toEqual({
            status: "skipped",
            steps: [
                {
                    label: "googleConnections.sheetOrders.skipped{}",
                    status: "skipped",
                    detail: "googleConnections.sheetOrders.skippedDetail{}",
                },
            ],
            evidence: null,
        })
        expect(sheets.runSheetEvent).not.toHaveBeenCalled()
    })
})

describe("GoogleSheetAutomationService / record", () => {
    it.each([
        { data: null, at: "" },
        { data: ["not", "an object"], at: 42 },
        { data: "text", at: undefined },
    ])("uses empty data and the clock for an unstructured payload: %j", async ({ data, at }) => {
        const { service, sheets } = await build()

        await expect(service.record(context, { event: "deal.won", data, at })).resolves.toEqual({
            status: "done",
            steps: [{ label: "googleConnections.sheetOrders.written{}", status: "done", detail: "Row 2" }],
            evidence: "Row 2",
        })
        expect(sheets.runSheetEvent).toHaveBeenCalledWith("ws-1", context.config, {
            event: "deal.won",
            data: {},
            occurredAt: NOW.toISOString(),
        })
    })
})

describe("GoogleSheetAutomationService / prepareEnable", () => {
    it("creates the spreadsheet named after the shop and keeps its id and link", async () => {
        const { service, sheets } = await build()

        await expect(service.prepareEnable("ws-1", sheetDef, { recordOrders: true })).resolves.toEqual({
            recordOrders: true,
            spreadsheetId: "sheet-new",
            sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-new/edit",
        })
        expect(sheets.provisionOrdersSheet).toHaveBeenCalledWith(
            "ws-1",
            'googleConnections.sheetTitle{"name":"Lan Shop"}',
            { recordOrders: true },
        )
    })

    it("leaves another template and an existing spreadsheet untouched", async () => {
        const { service, sheets } = await build()

        await expect(service.prepareEnable("ws-1", buildTemplate({ key: "thank_payment" }), { a: 1 })).resolves.toEqual(
            { a: 1 },
        )
        await expect(service.prepareEnable("ws-1", sheetDef, { spreadsheetId: "s1" })).resolves.toEqual({
            spreadsheetId: "s1",
        })
        expect(sheets.provisionOrdersSheet).not.toHaveBeenCalled()
    })

    it("uses the fallback shop name when a blank spreadsheet and workspace name are supplied", async () => {
        const { service, sheets, workspaces } = await build()
        workspaces.nameOf.mockResolvedValue("   ")
        const config = { spreadsheetId: " \t ", recordOrders: true }

        await expect(service.prepareEnable("ws-1", sheetDef, config)).resolves.toEqual({
            recordOrders: true,
            spreadsheetId: "sheet-new",
            sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-new/edit",
        })
        expect(sheets.provisionOrdersSheet).toHaveBeenCalledWith(
            "ws-1",
            'googleConnections.sheetTitle{"name":"NIVO"}',
            config,
        )
    })
})
