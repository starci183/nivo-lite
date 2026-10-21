import { randomBytes } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { EventsService } from "@modules/domain/events"
import type {
    AgentKeyAnswer,
    AgentKeyPrincipal,
    ApiKeyAuthAnswer,
    ApiKeyView,
    ApiPrincipal,
    ApiScope,
    CreatedApiKey,
} from "./api-keys.contracts"
import {
    ACTIVE_KEYS_MAX,
    admitAgentKey,
    admitKey,
    bearerKey,
    buildKey,
    cleanName,
    hashKey,
    mayManageKeys,
    TOOLS_CALL_SCOPE,
} from "./api-keys.policy"
import { ApiKeysError, ApiKeysErrorCode } from "./errors/api-keys.error"
import type { ApiKeysRow, MemberRow } from "./persistence/api-keys.rows"
import {
    API_AGENT_KEY,
    API_KEY_AUTH,
    API_KEY_CREDENTIAL,
    COUNT_ACTIVE_KEYS,
    INSERT_AGENT_KEY,
    INSERT_KEY,
    LIST_KEYS,
    REVOKE_KEY,
    SELECT_MEMBER,
} from "./persistence/api-keys.sql"

/** Bytes of entropy in one key. */
const KEY_ENTROPY_BYTES = 32

type KeyRow = Pick<ApiKeysRow, "id" | "name" | "key_prefix" | "created_at" | "last_used_at" | "revoked_at" | "agent_id">
type MemberFacts = Pick<MemberRow, "role" | "display_name">

const toView = (row: KeyRow): ApiKeyView => ({
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    agentId: row.agent_id,
})

@Injectable()
/**
 * The workspace API keys reached only through the shared primary EntityManager: the admission of a public API request.
 */
export class ApiKeysService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly events: EventsService,
    ) {}

    /**
     * Admits a public API request: the bearer key must exist, work, stay inside its minute budget and carry `scope`.
     * The lookup, the rate hit and the last-use stamp are one statement.
     */
    async authenticate(scope: ApiScope, authorization: string = ""): Promise<ApiPrincipal> {
        const key = bearerKey(authorization)
        if (key === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.Unauthorized })
        const [row] = await this.entityManager.query<Array<{ auth: ApiKeyAuthAnswer | null }>>(API_KEY_AUTH, [
            hashKey(key),
        ])
        const admitted = admitKey(row?.auth ?? null, scope, this.clock.now())
        if (admitted.kind === "refused") throw new ApiKeysError({ code: admitted.code, params: admitted.params })
        return admitted.value
    }

    /** Establishes a key identity without consuming its per-minute operation budget. */
    async verifyCredential(authorization: string): Promise<ApiPrincipal> {
        const key = bearerKey(authorization)
        if (key === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.Unauthorized })
        const [row] = await this.entityManager.query<Array<ApiKeyAuthAnswer>>(API_KEY_CREDENTIAL, [hashKey(key)])
        if (row?.revoked) throw new ApiKeysError({ code: ApiKeysErrorCode.Revoked })
        if (!row?.id || !row.workspace_id) throw new ApiKeysError({ code: ApiKeysErrorCode.Unauthorized })
        return { keyId: row.id, workspaceId: row.workspace_id, name: row.name ?? "", scopes: row.scopes ?? [] }
    }

    /**
     * Establishes the agent an MCP endpoint request acts as: the bearer key must work and be bound to an active agent of its
     * workspace with the `tools:call` scope. A revoked key, a public API key and the key of a deleted or paused agent are refused.
     */
    async verifyAgentKey(authorization: string): Promise<AgentKeyPrincipal> {
        const key = bearerKey(authorization)
        if (key === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.Unauthorized })
        const [row] = await this.entityManager.query<Array<AgentKeyAnswer>>(API_AGENT_KEY, [hashKey(key)])
        const admitted = admitAgentKey(row)
        if (admitted.kind === "refused") throw new ApiKeysError({ code: admitted.code, params: admitted.params })
        return admitted.value
    }

    /** The keys of a workspace, newest first, for an owner or manager of it. */
    async listKeys(principalId: string, workspaceId: string): Promise<Array<ApiKeyView>> {
        await this.requireManager(this.entityManager, principalId, workspaceId)
        const rows = await this.entityManager.query<Array<KeyRow>>(LIST_KEYS, [workspaceId])
        return rows.map(toView)
    }

    /**
     * Creates a key for a workspace; the secret is answered here once because only its hash is stored. With an agent, the key is
     * that agent's credential on the MCP endpoint: it carries only `tools:call` and the agent must be of the workspace.
     */
    createKey(principalId: string, workspaceId: string, rawName: string, agentId?: string): Promise<CreatedApiKey> {
        const named = cleanName(rawName)
        if (named.kind === "refused") throw new ApiKeysError({ code: named.code })
        return this.entityManager.transaction(async (tx) => {
            const member = await this.requireManager(tx, principalId, workspaceId)
            const [count] = await tx.query<Array<{ active: number }>>(COUNT_ACTIVE_KEYS, [workspaceId])
            if ((count?.active ?? 0) >= ACTIVE_KEYS_MAX) {
                throw new ApiKeysError({ code: ApiKeysErrorCode.LimitReached, params: { limit: ACTIVE_KEYS_MAX } })
            }
            const built = buildKey(randomBytes(KEY_ENTROPY_BYTES))
            const values = [workspaceId, named.value, built.prefix, built.hash, principalId]
            const [row] =
                agentId === undefined
                    ? await tx.query<Array<KeyRow>>(INSERT_KEY, values)
                    : await tx.query<Array<KeyRow>>(INSERT_AGENT_KEY, [...values, agentId, [TOOLS_CALL_SCOPE]])
            if (row === undefined) {
                const code = agentId === undefined ? ApiKeysErrorCode.NotCreated : ApiKeysErrorCode.AgentNotFound
                throw new ApiKeysError({ code })
            }
            await this.events.record(
                {
                    workspaceId,
                    kind: "api.key_created",
                    actor: member.display_name,
                    summary: `API key created: ${named.value}`,
                    evidence: built.prefix,
                },
                tx,
            )
            return { key: built.key, item: toView(row) }
        })
    }

    /** Revokes a working key of a workspace: it stops working at once and its row stays as history. */
    revokeKey(principalId: string, workspaceId: string, keyId: string): Promise<ApiKeyView> {
        return this.entityManager.transaction(async (tx) => {
            const member = await this.requireManager(tx, principalId, workspaceId)
            const [row] = await tx.query<Array<KeyRow>>(REVOKE_KEY, [workspaceId, keyId])
            if (row === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.NotFound })
            await this.events.record(
                {
                    workspaceId,
                    kind: "api.key_revoked",
                    actor: member.display_name,
                    summary: `API key revoked: ${row.name}`,
                    evidence: row.key_prefix,
                },
                tx,
            )
            return toView(row)
        })
    }

    private async requireManager(
        manager: EntityManager,
        principalId: string,
        workspaceId: string,
    ): Promise<MemberFacts> {
        const [member] = await manager.query<Array<MemberFacts>>(SELECT_MEMBER, [workspaceId, principalId])
        if (member === undefined || !mayManageKeys(member.role)) {
            throw new ApiKeysError({ code: ApiKeysErrorCode.NotManager })
        }
        return member
    }
}
