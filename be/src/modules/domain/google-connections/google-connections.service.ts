import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import { randomSecret } from "@modules/domain/connection-secrets"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import {
    DRIVE_PURPOSE,
    GOOGLE_SCOPE,
    InjectGoogleClient,
    isConsentFailure,
    safeReturnTo,
    withResult,
} from "@modules/integrations/google"
import type { GoogleClient, OAuthState } from "@modules/integrations/google"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DriveGrantService } from "./drive-grant.service"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"
import type {
    ConsentStart,
    GoogleConnectionAccount,
    GoogleCallbackInput,
    GoogleCallbackResult,
    GoogleSetup,
} from "./google-connections.contracts"
import { GoogleConnectionsLogEvent } from "./google-connections.log-events"
import { GoogleTokensService } from "./google-tokens.service"
import { CONSENT_PREFIX, consentFailureOf, deniedReason, storeFailureReason } from "./policies/consent-reason.policy"

const OWNER = ["owner"] as const
const MANAGER = ["owner", "manager"] as const

interface ConsentOutcome {
    readonly returnTo: string
    readonly result: "ok" | "error"
    readonly reason?: string
    readonly drive: boolean
}

const isLive = (connection: ConnectionRecord): boolean => connection.status !== "disconnected"

@Injectable()
/**
 * The Google connections of a workspace: the consent and the stored tokens (kept sealed, refreshed shortly before they expire).
 * A workspace may connect several Google accounts; the same account re-consenting updates its connection.
 * last_error carries the reason: "consent:<code>" when Google refused the consent, "invalid_grant" when the refresh token was revoked.
 * The same callback finishes the Drive read grant (purpose drive_read in the signed state), which the DriveGrantService stores.
 */
export class GoogleConnectionsService {
    constructor(
        private readonly connections: ConnectionsService,
        @InjectGoogleClient() private readonly google: GoogleClient,
        @InjectLogger() private readonly logger: Logger,
        private readonly tokens: GoogleTokensService,
        private readonly drive: DriveGrantService,
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

    /** Whether Google can be used on this deployment (owner or manager). */
    async state(actor: ConnectionActor): Promise<GoogleSetup> {
        await this.connections.authorize(actor, MANAGER)
        return { configured: this.google.isConfigured() }
    }

    /** The live Google accounts of the workspace, for an automation account picker (owner or manager). */
    async accounts(actor: ConnectionActor): Promise<ReadonlyArray<GoogleConnectionAccount>> {
        await this.connections.authorize(actor, MANAGER)
        return this.accountsOf(actor.workspaceId)
    }

    /** The live Google accounts of a workspace, oldest first, for a caller that already checked the person. */
    async accountsOf(workspaceId: string): Promise<ReadonlyArray<GoogleConnectionAccount>> {
        const rows = await this.connections.listByProvider(workspaceId, "google", { includeDisconnected: false })
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
        if (!this.google.isConfigured()) return back("error", "unavailable")
        const actor: ConnectionActor = { principalId: state.u, workspaceId: state.w }
        try {
            await this.connections.authorize(actor, MANAGER)
        } catch (cause) {
            this.logger.error(GoogleConnectionsLogEvent.ConsentForbidden, cause, { workspaceId: state.w })
            return back("error", "forbidden")
        }
        if (input.error) {
            if (!drive) await this.tryRecordFailure(state, input.error)
            return back("error", deniedReason(input.error))
        }
        if (!input.code) return back("error", "failed")
        try {
            if (drive) await this.drive.complete(state.w, state.u, input.code)
            else await this.connect(state.w, state.u, input.code)
            return back("ok")
        } catch (cause) {
            this.logger.error(GoogleConnectionsLogEvent.ConsentFailed, cause, { workspaceId: state.w, drive })
            const consent = consentFailureOf(cause)
            if (consent !== "" && !drive) await this.tryRecordFailure(state, consent)
            return back("error", storeFailureReason(cause))
        }
    }

    /** Exchanges a consent code and stores the Sheets connection of the account. */
    private async connect(workspaceId: string, userId: string, code: string): Promise<void> {
        const tokens = await this.google.exchangeCode(code)
        const email = await this.google.accountEmail(tokens)
        const rows = await this.connections.listByProvider(workspaceId, "google", { includeDisconnected: false })
        const row = this.consentRowOf(rows, email)
        const refresh = await this.tokens.keptRefresh(row, tokens.renewalToken)
        if (!refresh) throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing })
        await this.tokens.save({
            workspaceId,
            userId,
            row,
            provider: "google",
            name: email === null ? "Google" : `Google - ${email}`,
            meta: { ...row?.meta, email: email ?? row?.meta.email ?? "" },
            tokens: { access_token: tokens.accessToken, renewal_token: refresh, expires_at: tokens.expiresAt },
        })
    }

    /**
     * The connection a consent updates: the same Google account (same email) re-consenting updates its connection, another account
     * becomes another connection, and a row left by a refused consent is reused for the first account.
     */
    private consentRowOf(rows: ReadonlyArray<ConnectionRecord>, email: string | null): ConnectionRecord | null {
        const sameAccount = email === null ? undefined : rows.find((row) => row.meta.email === email)
        if (sameAccount) return sameAccount
        return rows.find((row) => row.status === "error" && (row.lastError ?? "").startsWith(CONSENT_PREFIX)) ?? null
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
        return rows.find(isLive) ?? null
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
