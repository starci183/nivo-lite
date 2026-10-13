import { Injectable } from "@nestjs/common"
import { ConnectionsService, randomSecret } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import {
    DRIVE_PURPOSE,
    GoogleError,
    InjectGoogleClient,
    isConsentFailure,
    safeReturnTo,
    sheetUrlOf,
    withResult,
} from "@modules/integrations/google"
import type {
    GoogleClient,
    GoogleTokenSet,
    SheetConfig,
    SheetEventIn,
    SheetEventResult,
} from "@modules/integrations/google"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"
import type {
    GoogleAccount,
    GoogleCallbackInput,
    GoogleCallbackResult,
    OrdersSheet,
    StoredGoogleTokens,
} from "./google-connections.contracts"

const OWNER = ["owner"] as const
const MANAGER = ["owner", "manager"] as const
const REFRESH_MARGIN_MS = 90_000
const CONSENT_PREFIX = "consent:"

interface ConsentOutcome {
    readonly returnTo: string
    readonly result: "ok" | "error"
    readonly reason?: string
    readonly drive: boolean
}

const isLive = (connection: ConnectionRecord): boolean => connection.status !== "disconnected"

const parseTokens = (plain: string): Partial<StoredGoogleTokens> => {
    try {
        const parsed: unknown = JSON.parse(plain)
        return typeof parsed === "object" && parsed !== null ? (parsed as Partial<StoredGoogleTokens>) : {}
    } catch {
        return {}
    }
}

@Injectable()
/**
 * The Google connections of a workspace: the consent, the stored tokens (kept sealed, refreshed shortly before they expire) and the
 * orders spreadsheet automation. A workspace may connect several Google accounts; the same account re-consenting updates its connection.
 * last_error carries the reason: "consent:<code>" when Google refused the consent, "invalid_grant" when the refresh token was revoked.
 */
export class GoogleConnectionsService {
    constructor(
        private readonly connections: ConnectionsService,
        @InjectGoogleClient() private readonly google: GoogleClient,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** True when Google can be used on this deployment. */
    isConfigured(): boolean {
        return this.google.isConfigured()
    }

    /** Starts the consent (owner): the Google url the browser must go to; the signed state is checked by the callback. */
    async authorize(actor: ConnectionActor, returnTo: string): Promise<{ readonly url: string }> {
        await this.connections.authorize(actor, OWNER)
        if (!this.google.isConfigured()) {
            throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.NotConfigured })
        }
        const state = this.google.sign({
            workspaceId: actor.workspaceId,
            userId: actor.principalId,
            returnTo: safeReturnTo(returnTo),
        })
        const url = this.google.authUrl(state)
        if (url === null) throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.StartFailed })
        return { url }
    }

    /** Whether Google can be used on this deployment (owner or manager). */
    async state(actor: ConnectionActor): Promise<{ readonly configured: boolean }> {
        await this.connections.authorize(actor, MANAGER)
        return { configured: this.google.isConfigured() }
    }

    /** The live Google accounts of the workspace, for an automation account picker (owner or manager). */
    async accounts(actor: ConnectionActor): Promise<ReadonlyArray<GoogleAccount>> {
        await this.connections.authorize(actor, MANAGER)
        const rows = await this.connections.listByProvider(actor.workspaceId, "google", { includeDisconnected: false })
        return rows.map((row) => ({ id: row.id, email: row.meta.email ?? "", status: row.status }))
    }

    /**
     * Finishes a consent. The signed state binds the return to the workspace and the person it was issued to, who must still be an
     * active owner or manager. The browser always goes back to a same-site path with the result; nothing here throws.
     */
    async complete(input: GoogleCallbackInput): Promise<GoogleCallbackResult> {
        const outcome = await this.finish(input)
        const path = withResult(outcome.returnTo, outcome.result, outcome.reason, outcome.drive ? "drive" : "google")
        return { location: `${this.connections.siteBase()}${path}` }
    }

    private async finish(input: GoogleCallbackInput): Promise<ConsentOutcome> {
        const state = this.safeVerify(input.state)
        if (state === null) return { returnTo: "/connections", result: "error", reason: "state", drive: false }
        const returnTo = safeReturnTo(state.r)
        const drive = state.p === DRIVE_PURPOSE
        const back = (result: "ok" | "error", reason?: string): ConsentOutcome => ({
            returnTo,
            result,
            drive,
            ...(reason === undefined ? {} : { reason }),
        })
        if (drive || !this.google.isConfigured()) return back("error", "unavailable")
        const actor: ConnectionActor = { principalId: state.u, workspaceId: state.w }
        try {
            await this.connections.authorize(actor, MANAGER)
        } catch {
            return back("error", "forbidden")
        }
        if (input.error) {
            await this.recordFailure(state.w, state.u, input.error).catch(() => undefined)
            const consent = isConsentFailure(input.error)
            return back("error", consent ? (input.error === "access_denied" ? "denied" : "unavailable") : "failed")
        }
        if (!input.code) return back("error", "failed")
        try {
            const tokens = await this.google.exchangeCode(input.code)
            const email = await this.google.accountEmail(tokens)
            await this.saveConnection(state.w, state.u, tokens, email)
            return back("ok")
        } catch (error) {
            const reason = error instanceof GoogleError ? String(error.params.reason ?? "") : ""
            if (error instanceof GoogleError && isConsentFailure(reason)) {
                await this.recordFailure(state.w, state.u, reason).catch(() => undefined)
                return back("error", "unavailable")
            }
            if (error instanceof GoogleConnectionsError && error.code === GoogleConnectionsErrorCode.Missing) {
                return back("error", "no_refresh")
            }
            return back("error", "failed")
        }
    }

    /** Creates the orders spreadsheet in the shop Drive when the config names none yet; answers the sheet either way. */
    async provisionOrdersSheet(workspaceId: string, workspaceName: string, config: SheetConfig): Promise<OrdersSheet> {
        const existing = typeof config.spreadsheetId === "string" ? config.spreadsheetId.trim() : ""
        if (existing) return { spreadsheetId: existing, spreadsheetUrl: sheetUrlOf(existing) }
        const connectionId = this.connectionOf(config)
        const made = await this.withToken(
            workspaceId,
            (token) => this.google.createOrdersSpreadsheet(token, `NIVO - ${workspaceName}`.slice(0, 120)),
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
    runSheetEvent(workspaceId: string, config: SheetConfig, event: SheetEventIn): Promise<SheetEventResult> {
        return this.withToken(
            workspaceId,
            (token) => this.google.applyEvent(token, config, event),
            this.connectionOf(config),
        )
    }

    private safeVerify(value: string | undefined) {
        try {
            return this.google.verify(value)
        } catch {
            return null
        }
    }

    private connectionOf(config: SheetConfig): string | null {
        const id = config.googleConnectionId
        return typeof id === "string" && id !== "" ? id : null
    }

    /** The named Google connection of the workspace, or its oldest live one. */
    private async loadRow(workspaceId: string, connectionId: string | null): Promise<ConnectionRecord | null> {
        const rows = await this.connections.listByProvider(workspaceId, "google", { includeDisconnected: false })
        return (connectionId === null ? rows.find(isLive) : rows.find((row) => row.id === connectionId)) ?? null
    }

    /**
     * Stores a successful consent. The same Google account (same email) re-consenting updates its connection, another account
     * becomes another connection, and a row left by a refused consent is reused for the first account.
     */
    private async saveConnection(
        workspaceId: string,
        userId: string,
        tokens: GoogleTokenSet,
        email: string | null,
    ): Promise<void> {
        const rows = await this.connections.listByProvider(workspaceId, "google", { includeDisconnected: false })
        const sameAccount = email === null ? undefined : rows.find((row) => row.meta.email === email)
        const failed = sameAccount
            ? undefined
            : rows.find((row) => row.status === "error" && (row.lastError ?? "").startsWith(CONSENT_PREFIX))
        const row = sameAccount ?? failed
        let refresh = tokens.refreshToken
        if (!refresh && row) {
            const sealed = await this.connections.readSecret(row.id)
            refresh = sealed === null ? null : (parseTokens(sealed.plain).refresh_token ?? null)
        }
        if (!refresh) throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing })
        const stored: StoredGoogleTokens = {
            access_token: tokens.accessToken,
            refresh_token: refresh,
            expires_at: tokens.expiresAt,
        }
        const meta = { ...(row?.meta ?? {}), email: email ?? row?.meta.email ?? "" }
        const name = email === null ? "Google" : `Google - ${email}`
        if (row) {
            await this.connections.patch(workspaceId, row.id, { name, status: "connected", lastError: null, meta })
            await this.connections.writeSecret(row.id, JSON.stringify(stored))
            return
        }
        await this.connections.create({
            workspaceId,
            createdBy: userId,
            provider: "google",
            name,
            status: "connected",
            environment: "live",
            meta,
            secret: { plain: JSON.stringify(stored), webhookSecret: randomSecret() },
        })
    }

    /** Google refused the consent (access_denied, invalid_client ...): remember it so the card says NIVO has not enabled Google yet. */
    private async recordFailure(workspaceId: string, userId: string, code: string): Promise<void> {
        if (!isConsentFailure(code)) return
        const row = await this.loadRow(workspaceId, null)
        const lastError = `${CONSENT_PREFIX}${code}`
        if (row?.status === "connected") return
        if (row) {
            await this.connections.patch(workspaceId, row.id, { status: "error", lastError })
            return
        }
        await this.connections.create({
            workspaceId,
            createdBy: userId,
            provider: "google",
            name: "Google",
            status: "pending",
            environment: "live",
            meta: {},
            secret: { plain: "{}", webhookSecret: randomSecret() },
        })
        const created = await this.loadRow(workspaceId, null)
        if (created) await this.connections.patch(workspaceId, created.id, { status: "error", lastError })
    }

    /** A valid access token: refreshed lazily shortly before expiry and stored again sealed. */
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
        const sealed = await this.connections.readSecret(row.id)
        const stored = sealed === null ? {} : parseTokens(sealed.plain)
        if (!stored.refresh_token) throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Lost })
        const now = this.clock.now().getTime()
        if (!force && stored.access_token && (stored.expires_at ?? 0) - REFRESH_MARGIN_MS > now) {
            return stored.access_token
        }
        try {
            const fresh = await this.google.refreshAccessToken(stored.refresh_token)
            const next: StoredGoogleTokens = {
                access_token: fresh.accessToken,
                refresh_token: fresh.refreshToken ?? stored.refresh_token,
                expires_at: fresh.expiresAt,
            }
            await this.connections.writeSecret(row.id, JSON.stringify(next))
            return fresh.accessToken
        } catch (error) {
            if (error instanceof GoogleError && error.params.reason === "invalid_grant") {
                await this.connections.patch(workspaceId, row.id, { status: "error", lastError: "invalid_grant" })
                throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Lost })
            }
            throw error
        }
    }

    /** Runs `work` with a token; one forced refresh and retry when Google answers 401 (the token was revoked or rotated early). */
    private async withToken<T>(
        workspaceId: string,
        work: (token: string) => Promise<T>,
        connectionId: string | null,
    ): Promise<T> {
        const token = await this.accessToken(workspaceId, false, connectionId)
        try {
            return await work(token)
        } catch (error) {
            if (!(error instanceof GoogleError) || error.params.status !== 401) throw error
            return work(await this.accessToken(workspaceId, true, connectionId))
        }
    }
}
