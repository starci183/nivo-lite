import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { PipelineConfig } from "@modules/domain/automation-pipelines"
import type { RunResult } from "@modules/domain/automation-runs"
import type { TemplateDefinition } from "@modules/domain/automation-templates"
import { AutomationExtensionsService } from "@modules/domain/automations"
import type { ExecutorContext, ExecutorPayload } from "@modules/domain/automations"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { SheetEventName } from "@modules/integrations/google"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { GoogleConnectionsService } from "./google-connections.service"

/** The template this extension owns. */
const SHEET_ORDERS = "sheet_orders"
const SHEET_EVENTS: ReadonlyArray<SheetEventName> = ["order.confirmed", "deal.won", "payment.received", "lead.created"]
const FALLBACK_NAME = "NIVO"

const isSheetEvent = (value: unknown): value is SheetEventName =>
    typeof value === "string" && SHEET_EVENTS.some((event) => event === value)

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : {}

@Injectable()
/**
 * The Google Sheet orders automation plugged into the automations engine: its executor writes one NIVO event to the shop sheet, its
 * switch-on creates the spreadsheet when the pipeline names none, and it answers the Google accounts a spreadsheet template can write with.
 */
export class GoogleSheetAutomationService implements OnModuleInit {
    constructor(
        private readonly extensions: AutomationExtensionsService,
        private readonly google: GoogleConnectionsService,
        private readonly workspaces: WorkspacesService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Registers the extension with the automations engine at boot. */
    onModuleInit(): void {
        this.extensions.add({
            executors: { [SHEET_ORDERS]: (context, payload) => this.record(context, payload) },
            prepareEnable: (workspaceId, _userId, def, config) => this.prepareEnable(workspaceId, def, config),
            googleAccounts: (workspaceId) => this.google.accountsOf(workspaceId),
        })
    }

    /**
     * Writes one event to the sheet (a row appended or updated). A kind of event the owner switched off is a skipped run; any Google
     * failure propagates so the engine retries the run.
     */
    async record(context: ExecutorContext, payload: ExecutorPayload): Promise<RunResult> {
        const event = payload.event
        if (!isSheetEvent(event)) return this.skipped(this.say("sheetOrders.skippedDetail"), null)
        const out = await this.google.runSheetEvent(context.workspaceId, context.config, {
            event,
            data: recordOf(payload.data),
            occurredAt: this.occurredAt(payload.at),
        })
        if (out.skipped) return this.skipped(this.say("sheetOrders.skippedDetail"), out.evidence)
        return {
            status: "done",
            steps: [{ label: this.say("sheetOrders.written"), status: "done", detail: out.evidence }],
            evidence: out.evidence,
        }
    }

    /**
     * At the switch-on of the orders sheet, creates the spreadsheet in the shop Drive when the config names none and keeps its id and link
     * in the config. Without a usable Google account the typed error refuses the switch-on; other templates pass through untouched.
     */
    async prepareEnable(workspaceId: string, def: TemplateDefinition, config: PipelineConfig): Promise<PipelineConfig> {
        if (def.key !== SHEET_ORDERS) return config
        const existing = typeof config.spreadsheetId === "string" ? config.spreadsheetId.trim() : ""
        if (existing !== "") return config
        const name = (await this.workspaces.nameOf(workspaceId)).trim() || FALLBACK_NAME
        const sheet = await this.google.provisionOrdersSheet(workspaceId, this.say("sheetTitle", { name }), config)
        return { ...config, spreadsheetId: sheet.spreadsheetId, sheetUrl: sheet.spreadsheetUrl }
    }

    private skipped(detail: string, evidence: string | null): RunResult {
        return {
            status: "skipped",
            steps: [{ label: this.say("sheetOrders.skipped"), status: "skipped", detail }],
            evidence,
        }
    }

    private occurredAt(value: unknown): string {
        if (value instanceof Date) return value.toISOString()
        return typeof value === "string" && value !== "" ? value : this.clock.now().toISOString()
    }

    /** The Vietnamese text of a key; the runs the owner reads are stored in Vietnamese. */
    private say(key: string, params: Readonly<Record<string, string>> = {}): string {
        return this.catalog.get(`googleConnections.${key}`, params, "vi")
    }
}
