import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { storedAvatarAddress } from "@modules/integrations/object-storage"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMembersError, WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import type { AccountDirectory, AccountOverview, DeviceSession } from "./workspace-members.contracts"
import { InjectAccountDirectory } from "./workspace-members.port"

/** A timestamp as the database function answers it: a date, or text, or none. */
type StoredInstant = Date | string | null

/** One row of `public.be_account_sessions`. */
interface SessionRow {
    readonly id: string
    readonly created_at: StoredInstant
    readonly last_active_at: StoredInstant
    readonly user_agent: string | null
    readonly ip: string | null
}

/** One row of `public.be_account_providers`. */
interface ProviderRow {
    readonly provider: string
}

/** The answer of `public.be_revoke_session`: one row named after the function. */
interface RevokedRow {
    readonly be_revoke_session: boolean
}

/** The most sessions and providers the overview lists. */
const SESSION_LIMIT = 100
const PROVIDER_LIMIT = 20

const isoOf = (value: StoredInstant): string | null => (value === null ? null : new Date(value).toISOString())

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
            callDbFunction<ProviderRow>(this.entityManager, "public.be_account_providers", [userId]),
            callDbFunction<SessionRow>(this.entityManager, "public.be_account_sessions", [userId]),
        ])
        const known = profile.kind === "ok" ? profile.value : undefined
        const devices = sessions.slice(0, SESSION_LIMIT).map((row): DeviceSession => ({
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
            avatarUrl: storedAvatarAddress(known?.avatarUrl ?? null),
            uploadedAvatarUrl: storedAvatarAddress(known?.uploadedAvatarUrl ?? null),
            providers: providers.slice(0, PROVIDER_LIMIT).map((row) => row.provider),
            sessions: [...devices].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent)),
        }
    }

    /** Signs another device of the account out; the session the request runs on is refused. */
    async revokeSession(userId: string, sessionId: string, currentSessionId?: string): Promise<void> {
        if (sessionId === currentSessionId)
            throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.CurrentSession })
        const [row] = await callDbFunction<RevokedRow>(this.entityManager, "public.be_revoke_session", [
            userId,
            sessionId,
        ])
        if (!row?.be_revoke_session)
            throw new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.SessionNotFound })
    }
}
