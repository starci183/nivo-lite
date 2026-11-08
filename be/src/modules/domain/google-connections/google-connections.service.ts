import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionActor, type ConnectionRecord } from "@modules/domain/connections"
import { randomSecret } from "@modules/domain/connection-secrets"
import {
    DRIVE_PURPOSE,
    GOOGLE_SCOPE,
    InjectGoogleClient,
    isConsentFailure,
    SHEETS_PURPOSE,
    safeReturnTo,
    withResult,
    type GoogleClient,
    type OAuthState,
} from "@modules/integrations/google"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { DriveGrantService } from "./drive-grant.service"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"
import type {
    ConsentStart,
    GoogleConnectionAccount,
    GoogleCallbackInput,
    GoogleCallbackResult,
    GoogleSetup,
    GoogleSetupWithLedger,
    ConsentPurpose,
} from "./google-connections.contracts"
import { GoogleConnectionsLogEvent } from "./google-connections.log-events"
import { GoogleTokensService } from "./google-tokens.service"
import { CONSENT_PREFIX, consentFailureOf, deniedReason, storeFailureReason } from "./policies/consent-reason.policy"
import { consentRowOf, consentedMeta } from "./policies/ledger-sheet.policy"
import { SheetsGrantService } from "./sheets-grant.service"

const OWNER = ["owner"] as const
const MANAGER = ["owner", "manager"] as const

interface ConsentOutcome {
    readonly returnTo: string
    readonly result: "ok" | "error"
    readonly reason?: string
    readonly key: "google" | "drive" | "sheets"
}

/** The grant a signed state asks for: the Sheets connection has no purpose. */
const keyOf = (purpose: string | undefined): ConsentOutcome["key"] => {
    if (purpose === DRIVE_PURPOSE) return "drive"
    return purpose === SHEETS_PURPOSE ? "sheets" : "google"
}

const isLive = (connection: ConnectionRecord): boolean => connection.status !== "disconnected"

/** True for the connection the seed made: it holds no token until the owner consents once. */
const waitsForConsent = (connection: ConnectionRecord): boolean =>
    connection.status === "pending" && connection.meta.consent === "needed"

@Injectable()
/**
 * The Google connections of a workspace: the consent and the stored tokens (kept sealed, refreshed shortly before they expire).
 * A workspace may connect several Google accounts; the same account re-consenting updates its connection.
 * last_error carries the reason: "consent:<code>" when Google refused the consent, "invalid_grant" when the refresh token was revoked.
 * The same callback finishes the Drive read grant (purpose drive_read in the signed state), which the DriveGrantService stores, and the
 * ledger grant (purpose sheets_ledger), which the SheetsGrantService stores.
 * A connection the workspace seed made waits for the owner first consent (meta.consent "needed", status pending, no token) and is the
 * row that consent fills.
 */
export class GoogleConnectionsService {
    constructor(
        private readonly connections: ConnectionsService,
        @InjectGoogleClient() private readonly google: GoogleClient,
        @InjectLogger() private readonly logger: Logger,
        private readonly tokens: GoogleTokensService,
        private readonly drive: DriveGrantService,
        private readonly sheets: SheetsGrantService,
    ) {}

    /** True when Google can be used on this deployment. */
    isConfigured(): boolean {
        return this.google.isConfigured()
    }

    /** Starts the consent (owner): the Google url the browser must go to; the signed state is checked by the callback. */
    async authorize(actor: ConnectionActor, returnTo: string): Promise<ConsentStart> {
        await this.connections.authorize(actor, OWNER)
        return this.tokens.consent({ actor, returnTo, scope: GOOGLE_SCOPE })
    }

    /** Starts the consent the purpose names (owner): the spreadsheets access of the ledger, or the Google connection itself. */
    consentFor(actor: ConnectionActor, returnTo: string, purpose: ConsentPurpose): Promise<ConsentStart> {
        return purpose === "sheets" ? this.sheets.authorize(actor, returnTo) : this.authorize(actor, returnTo)
    }

    /** Whether Google can be used on this deployment and where the ledger of the workspace stands (owner or manager). */
    async stateWithLedger(actor: ConnectionActor): Promise<GoogleSetupWithLedger> {
        const [setup, ledger] = await Promise.all([this.state(actor), this.sheets.grant(actor)])
        return { ...setup, ledger }
    }

    /** Whether Google can be used on this deployment (owner or manager). */
    async state(actor: ConnectionActor): Promise<GoogleSetup> {
        await this.connections.authorize(actor, MANAGER)
        const rows = await this.connections.listByProvider(actor.workspaceId, "google", { includeDisconnected: false })
        return {
            configured: this.google.isConfigured(),
            consentNeeded: rows.some((connection) => waitsForConsent(connection)),
        }
    }

    /** The live Google accounts of the workspace, for an automation account picker (owner or manager). */
    async accounts(actor: ConnectionActor): Promise<ReadonlyArray<GoogleConnectionAccount>> {
        await this.connections.authorize(actor, MANAGER)
        return this.accountsOf(actor.workspaceId)
    }

    /** The live Google accounts of a workspace, oldest first, for a caller that already checked the person. */
    async accountsOf(workspaceId: string): Promise<ReadonlyArray<GoogleConnectionAccount>> {
        const rows = await this.connections.listByProvider(workspaceId, "google", { includeDisconnected: false })
        return rows.map((row) => ({
            id: row.id,
            email: row.meta.email ?? "",
            status: row.status,
            consentNeeded: waitsForConsent(row),
        }))
    }

    /**
     * Finishes a consent. The signed state binds the return to the workspace and the person it was issued to, who must still be an
     * active owner or manager. The browser always goes back to a same-site path with the result; nothing here throws.
     */
    async complete(input: GoogleCallbackInput): Promise<GoogleCallbackResult> {
        const outcome = await this.finish(input)
        const path = withResult(outcome.returnTo, outcome.result, outcome.reason, outcome.key)
        return { location: `${this.connections.siteBase()}${path}` }
    }

    private async finish(input: GoogleCallbackInput): Promise<ConsentOutcome> {
        const state = this.safeVerify(input.state)
        if (state === null) return { returnTo: "/connections", result: "error", reason: "state", key: "google" }
        const returnTo = safeReturnTo(state.r)
        const key = keyOf(state.p)
        const back = (result: "ok" | "error", reason?: string): ConsentOutcome => ({
            returnTo,
            result,
            key,
            ...(reason === undefined ? {} : { reason }),
        })
        if (!this.google.isConfigured()) return back("error", "unavailable")
        const actor: ConnectionActor = { principalId: state.u, workspaceId: state.w }
        try {
            await this.connections.authorize(actor, MANAGER)
        } catch (cause) {
            this.logger.error(GoogleConnectionsLogEvent.ConsentForbidden, cause, { workspaceId: state.w })
            return back("error", "forbidden")
        }
        if (input.error) {
            if (key === "google") await this.tryRecordFailure(state, input.error)
            return back("error", deniedReason(input.error))
        }
        if (!input.code) return back("error", "failed")
        try {
            await this.store(key, state, input.code)
            return back("ok")
        } catch (cause) {
            this.logger.error(GoogleConnectionsLogEvent.ConsentFailed, cause, { workspaceId: state.w, grant: key })
            const consent = consentFailureOf(cause)
            if (consent !== "" && key === "google") await this.tryRecordFailure(state, consent)
            return back("error", storeFailureReason(cause))
        }
    }

    /** Hands the consent code to the grant the state asked for. */
    private async store(key: ConsentOutcome["key"], state: OAuthState, code: string): Promise<void> {
        if (key === "drive") await this.drive.complete(state.w, state.u, code)
        else if (key === "sheets") await this.sheets.complete(state.w, state.u, code)
        else await this.connect(state.w, state.u, code)
    }

    /** Exchanges a consent code and stores the Sheets connection of the account. */
    private async connect(workspaceId: string, userId: string, code: string): Promise<void> {
        const tokens = await this.google.exchangeCode(code)
        const email = await this.google.accountEmail(tokens)
        const rows = await this.connections.listByProvider(workspaceId, "google", { includeDisconnected: false })
        const row = consentRowOf(rows, email)
        const refresh = await this.tokens.keptRefresh(row, tokens.renewalToken)
        if (!refresh) throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing })
        await this.tokens.save({
            workspaceId,
            userId,
            row,
            provider: "google",
            name: email === null ? "Google" : `Google - ${email}`,
            meta: consentedMeta(row?.meta, email ?? row?.meta.email ?? ""),
            tokens: { access_token: tokens.accessToken, renewal_token: refresh, expires_at: tokens.expiresAt },
        })
    }

    private safeVerify(value: string | undefined): OAuthState | null {
        try {
            return this.google.verify(value)
        } catch (cause) {
            this.logger.error(GoogleConnectionsLogEvent.StateUnreadable, cause)
            return null
        }
    }

    /** The oldest live Google connection of the workspace. */
    private async oldestLive(workspaceId: string): Promise<ConnectionRecord | null> {
        const rows = await this.connections.listByProvider(workspaceId, "google", { includeDisconnected: false })
        return rows.find((connection) => isLive(connection)) ?? null
    }

    /** Records a refused consent; a failure to record is logged and never changes where the browser goes. */
    private async tryRecordFailure(state: OAuthState, code: string): Promise<void> {
        try {
            await this.recordFailure(state.w, state.u, code)
        } catch (cause) {
            this.logger.error(GoogleConnectionsLogEvent.FailureNotRecorded, cause, { workspaceId: state.w })
        }
    }

    /** Google refused the consent (access_denied, invalid_client ...): remember it so the card says NIVO has not enabled Google yet. */
    private async recordFailure(workspaceId: string, userId: string, code: string): Promise<void> {
        if (!isConsentFailure(code)) return
        const row = await this.oldestLive(workspaceId)
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
        const created = await this.oldestLive(workspaceId)
        if (created) await this.connections.patch(workspaceId, created.id, { status: "error", lastError })
    }
}
