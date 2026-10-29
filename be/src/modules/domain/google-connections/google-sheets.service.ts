import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { PipelineConfig } from "@modules/domain/automation-pipelines"
import { GoogleError, InjectGoogleClient, sheetUrlOf } from "@modules/integrations/google"
import type { GoogleClient, SheetEventIn, SheetEventResult } from "@modules/integrations/google"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"
import type { OrdersSheet } from "./google-connections.contracts"
import { GoogleTokensService } from "./google-tokens.service"
import { CONSENT_PREFIX } from "./policies/consent-reason.policy"

const TITLE_MAX = 120

const isLive = (connection: ConnectionRecord): boolean => connection.status !== "disconnected"

const isUnauthorized = (error: unknown): boolean => error instanceof GoogleError && error.params.status === 401

const connectionOf = (config: PipelineConfig): string | null => {
    const id = config.googleConnectionId
    return typeof id === "string" && id !== "" ? id : null
}

@Injectable()
/**
 * The shop spreadsheet over a Google connection: creates the orders sheet and applies one NIVO event to it, with a token of the named
 * (or oldest live) Google account; a token Google refuses with 401 is refreshed once and the call retried.
 */
export class GoogleSheetsService {
    constructor(
        private readonly connections: ConnectionsService,
        @InjectGoogleClient() private readonly google: GoogleClient,
        private readonly tokens: GoogleTokensService,
    ) {}

    /** Creates the orders spreadsheet (titled `title`) in the shop Drive when the config names none yet; answers the sheet either way. */
    async provisionOrdersSheet(workspaceId: string, title: string, config: PipelineConfig): Promise<OrdersSheet> {
        const existing = typeof config.spreadsheetId === "string" ? config.spreadsheetId.trim() : ""
        if (existing) return { spreadsheetId: existing, spreadsheetUrl: sheetUrlOf(existing) }
        const connectionId = connectionOf(config)
        const made = await this.withToken(
            workspaceId,
            (token) => this.google.createOrdersSpreadsheet(token, title.slice(0, TITLE_MAX)),
            connectionId,
        )
        const row = await this.loadRow(workspaceId, connectionId)
        if (row) {
            await this.connections.patch(workspaceId, row.id, {
                meta: { ...row.meta, sheet_id: made.spreadsheetId, sheet_url: made.spreadsheetUrl },
            })
        }
        return made
    }

    /** Applies one NIVO event to the shop sheet; throws on any failure so the automation run is retried. */
    runSheetEvent(workspaceId: string, config: PipelineConfig, event: SheetEventIn): Promise<SheetEventResult> {
        return this.withToken(workspaceId, (token) => this.google.applyEvent(token, config, event), connectionOf(config))
    }

    /** The named Google connection of the workspace, or its oldest live one. */
    private async loadRow(workspaceId: string, connectionId: string | null): Promise<ConnectionRecord | null> {
        const rows = await this.connections.listByProvider(workspaceId, "google", { includeDisconnected: false })
        return (connectionId === null ? rows.find(isLive) : rows.find((row) => row.id === connectionId)) ?? null
    }

    /** A valid access token of the named (or oldest) Google connection; a missing, refused or revoked one is a typed error. */
    private async accessToken(workspaceId: string, force: boolean, connectionId: string | null): Promise<string> {
        if (!this.google.isConfigured()) {
            throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.NotConfigured })
        }
        const row = await this.loadRow(workspaceId, connectionId)
        if (!row || row.status === "pending") {
            throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing })
        }
        if (row.status === "error") {
            const consent = (row.lastError ?? "").startsWith(CONSENT_PREFIX)
            throw new GoogleConnectionsError({
                code: consent ? GoogleConnectionsErrorCode.NotConfigured : GoogleConnectionsErrorCode.Lost,
            })
        }
        return this.tokens.accessToken({ row, force })
    }

    /** Runs `work` with a token; one forced refresh and retry when Google answers 401 (the token was revoked or rotated early). */
    private withToken<T>(
        workspaceId: string,
        work: (token: string) => Promise<T>,
        connectionId: string | null,
    ): Promise<T> {
        return this.tokens.withRetry(
            (force) => this.accessToken(workspaceId, force, connectionId),
            work,
            isUnauthorized,
        )
    }
}
