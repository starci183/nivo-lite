import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectAccountDirectory } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AccountOverview, DeviceSession } from "./accounts.contracts"
import { AccountsError, AccountsErrorCode } from "./errors/accounts.error"
import type { ProviderRow, RevokedRow, SessionRow } from "./persistence/accounts.rows"
import { LIST_PROVIDERS, LIST_SESSIONS, REVOKE_SESSION } from "./persistence/accounts.sql"

const isoOf = (value: Date | string | null): string | null => (value === null ? null : new Date(value).toISOString())

@Injectable()
/** The signed-in person's own account: linked sign-in methods and signed-in devices. */
export class AccountsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectAccountDirectory() private readonly accounts: AccountDirectory,
    ) {}

    /** The profile, the linked sign-in methods and the devices signed in, the current one first. */
    async overview(userId: string, currentSessionId?: string): Promise<AccountOverview> {
        const [profile, providers, sessions] = await Promise.all([
            this.accounts.accountOf(userId),
            this.entityManager.query<Array<ProviderRow>>(LIST_PROVIDERS, [userId]),
            this.entityManager.query<Array<SessionRow>>(LIST_SESSIONS, [userId]),
        ])
        const known = profile.kind === "ok" ? profile.value : undefined
        const devices = sessions.map((row): DeviceSession => ({
            id: row.id,
            userAgent: row.user_agent,
            ip: row.ip,
            createdAt: isoOf(row.created_at),
            lastActiveAt: isoOf(row.last_active_at),
            isCurrent: row.id === currentSessionId,
        }))
        return {
            name: known?.displayName ?? "",
            email: known?.email ?? "",
            providers: providers.map((row) => row.provider),
            sessions: [...devices].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent)),
        }
    }

    /** Signs another device of the account out; the session the request runs on is refused. */
    async revokeSession(userId: string, sessionId: string, currentSessionId?: string): Promise<void> {
        if (sessionId === currentSessionId) throw new AccountsError({ code: AccountsErrorCode.CurrentSession })
        const [row] = await this.entityManager.query<Array<RevokedRow>>(REVOKE_SESSION, [userId, sessionId])
        if (row === undefined || !row.revoked) throw new AccountsError({ code: AccountsErrorCode.SessionNotFound })
    }
}
