import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMembersError, WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import type { ProviderRow, RevokedRow, SessionRow } from "./persistence/account-sessions.rows"
import { LIST_PROVIDERS, LIST_SESSIONS, REVOKE_SESSION } from "./persistence/account-sessions.sql"
import type { AccountDirectory, AccountOverview, DeviceSession } from "./workspace-members.contracts"
import { InjectAccountDirectory } from "./workspace-members.port"

const isoOf = (value: Date | string | null): string | null => (value === null ? null : new Date(value).toISOString())

@Injectable()
/** The signed-in person's own account: linked sign-in methods and signed-in devices. */
export class AccountSessionsService {
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
            avatarUrl: known?.avatarUrl ?? null,
            uploadedAvatarUrl: known?.uploadedAvatarUrl ?? null,
            providers: providers.map((row) => row.provider),
            sessions: [...devices].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent)),
        }
    }

    /** Signs another device of the account out; the session the request runs on is refused. */
    async revokeSession(userId: string, sessionId: string, currentSessionId?: string): Promise<void> {
        if (sessionId === currentSessionId)
            throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.CurrentSession })
        const [row] = await this.entityManager.query<Array<RevokedRow>>(REVOKE_SESSION, [userId, sessionId])
        if (!row?.revoked) throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.SessionNotFound })
    }
}
