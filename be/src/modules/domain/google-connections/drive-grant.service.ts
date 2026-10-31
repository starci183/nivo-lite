import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import type { DriveAccessSource } from "@modules/domain/knowledge"
import { DocumentsError, DocumentsErrorCode } from "@modules/integrations/documents"
import type { DriveAccess } from "@modules/integrations/documents"
import { DRIVE_PURPOSE, DRIVE_READ_SCOPE, GoogleError, InjectGoogleClient } from "@modules/integrations/google"
import type { GoogleClient } from "@modules/integrations/google"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "./errors/google-connections.error"
import type { ConsentStart, DriveGrant } from "./google-connections.contracts"
import { GoogleTokensService } from "./google-tokens.service"
import { grantsDriveRead } from "./policies/google-tokens.policy"

const MANAGER = ["owner", "manager"] as const
const OWNER = ["owner"] as const
const PROVIDER = "google_drive"

const isRejectedToken = (error: unknown): boolean =>
    (error instanceof DocumentsError && error.code === DocumentsErrorCode.TokenRejected) ||
    (error instanceof GoogleError && error.params.status === 401)

@Injectable()
/**
 * The Google Drive read grant of a workspace: one connection of provider `google_drive` per workspace, kept apart from the Sheets
 * accounts. The tokens are sealed like the Sheets connection's; meta.email names the Google account; status error with last_error
 * invalid_grant means the owner revoked it. The consent reuses the Google callback with purpose drive_read in the signed state.
 */
export class DriveGrantService implements DriveAccessSource {
    constructor(
        private readonly connections: ConnectionsService,
        @InjectGoogleClient() private readonly google: GoogleClient,
        private readonly tokens: GoogleTokensService,
    ) {}

    /** The Drive access of a workspace for the knowledge capability: its state and its token, both read when used. */
    forWorkspace(workspaceId: string): DriveAccess {
        return {
            state: async () => (await this.grantOf(workspaceId)).state,
            withToken: (use) =>
                this.tokens.withRetry((force) => this.accessToken(workspaceId, force), use, isRejectedToken),
        }
    }

    /** Where the grant of the workspace stands and which Google account gave it (owner or manager). */
    async grant(actor: ConnectionActor): Promise<DriveGrant> {
        await this.connections.authorize(actor, MANAGER)
        return this.grantOf(actor.workspaceId)
    }

    /** Starts the Drive read consent (owner or manager): the Google url the browser must go to. */
    async authorize(actor: ConnectionActor, returnTo: string): Promise<ConsentStart> {
        await this.connections.authorize(actor, MANAGER)
        return this.tokens.consent({ actor, returnTo, scope: DRIVE_READ_SCOPE, purpose: DRIVE_PURPOSE })
    }

    /** Forgets the grant (owner only, like Zalo and SePay): the connection and its sealed tokens are deleted (the access can still be removed on the Google side). */
    async disconnect(actor: ConnectionActor): Promise<void> {
        await this.connections.authorize(actor, OWNER)
        const rows = await this.connections.listByProvider(actor.workspaceId, PROVIDER, { includeDisconnected: true })
        await Promise.all(rows.map((row) => this.connections.remove(actor.workspaceId, row.id)))
    }

    /**
     * Stores the grant a consent code gives. Throws GOOGLE_CONNECTIONS_SCOPE_MISSING when the owner unticked Drive on the consent screen
     * and GOOGLE_CONNECTIONS_MISSING when Google sent no refresh token and none was kept from before.
     */
    async complete(workspaceId: string, userId: string, code: string): Promise<void> {
        const tokens = await this.google.exchangeCode(code)
        if (!grantsDriveRead(tokens.scope)) {
            throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.ScopeMissing })
        }
        const email = await this.google.accountEmail(tokens)
        const row = await this.loadRow(workspaceId)
        const refresh = await this.tokens.keptRefresh(row, tokens.renewalToken)
        if (!refresh) throw new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing })
        await this.tokens.save({
            workspaceId,
            userId,
            row,
            provider: PROVIDER,
            name: email === null ? "Google Drive" : `Google Drive - ${email}`,
            meta: { email: email ?? "" },
            tokens: { access_token: tokens.accessToken, renewal_token: refresh, expires_at: tokens.expiresAt },
        })
    }

    private async grantOf(workspaceId: string): Promise<DriveGrant> {
        const row = await this.loadRow(workspaceId)
        if (!row || row.status === "pending") return { state: "none", email: "" }
        return { state: row.status === "error" ? "lost" : "connected", email: row.meta.email ?? "" }
    }

    /** The oldest live grant connection of the workspace. */
    private async loadRow(workspaceId: string): Promise<ConnectionRecord | null> {
        const rows = await this.connections.listByProvider(workspaceId, PROVIDER, { includeDisconnected: false })
        return rows[0] ?? null
    }

    /** A valid access token of the grant; a missing grant and a revoked one are the typed documents errors. */
    private async accessToken(workspaceId: string, force: boolean): Promise<string> {
        const row = await this.loadRow(workspaceId)
        if (!row || row.status === "pending") throw new DocumentsError({ code: DocumentsErrorCode.DriveGrantMissing })
        if (row.status === "error") throw new DocumentsError({ code: DocumentsErrorCode.DriveGrantLost })
        try {
            return await this.tokens.accessToken({ row, force })
        } catch (error) {
            if (!(error instanceof GoogleConnectionsError) || error.code !== GoogleConnectionsErrorCode.Lost)
                throw error
            throw new DocumentsError({ code: DocumentsErrorCode.DriveGrantLost, cause: error })
        }
    }
}
