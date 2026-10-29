import { randomBytes } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { AgentDirectoryService } from "@modules/domain/agents"
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
import { ApiKeyEntity } from "./persistence/entities"

/** Bytes of entropy in one key. */
const KEY_ENTROPY_BYTES = 32

/** The columns a write answers, named as the entity properties so the answer reads as an entity. */
const RETURNED =
    'id, name, key_prefix AS "keyPrefix", created_at AS "createdAt", last_used_at AS "lastUsedAt", revoked_at AS "revokedAt", agent_id AS "agentId"'

interface MemberFacts {
    readonly role: string
    readonly displayName: string
}

/** True when a RETURNING row carries the key shape the returned columns give it. */
const isApiKeyEntity = (value: unknown): value is ApiKeyEntity =>
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"

/** The rows a write answered. */
const returnedKeys = (raw: unknown): Array<ApiKeyEntity> => (Array.isArray(raw) ? raw.filter(isApiKeyEntity) : [])

const iso = (at: Date | null): string | null => (at === null ? null : at.toISOString())

const toView = (row: ApiKeyEntity): ApiKeyView => ({
    id: row.id,
    name: row.name,
    prefix: row.keyPrefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: iso(row.lastUsedAt),
    revokedAt: iso(row.revokedAt),
    agentId: row.agentId,
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
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly agents: AgentDirectoryService,
    ) {}

    /**
     * Admits a public API request: the bearer key must exist, work, stay inside its minute budget and carry `scope`.
     * The lookup, the rate hit and the last-use stamp are one statement.
     */
    async authenticate(scope: ApiScope, authorization: string = ""): Promise<ApiPrincipal> {
        const key = bearerKey(authorization)
        if (key === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.Unauthorized })
        const [row] = await callDbFunction<{ api_key_auth: ApiKeyAuthAnswer | null }>(
            this.entityManager,
            "public.api_key_auth",
            [hashKey(key)],
        )
        const admitted = admitKey(row?.api_key_auth ?? null, scope, this.clock.now())
        if (admitted.kind === "refused") throw new ApiKeysError({ code: admitted.code, params: admitted.params })
        return admitted.value
    }

    /** Establishes a key identity without consuming its per-minute operation budget. */
    async verifyCredential(authorization: string): Promise<ApiPrincipal> {
        const key = bearerKey(authorization)
        if (key === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.Unauthorized })
        const row = await this.entityManager.findOne(ApiKeyEntity, {
            select: { id: true, workspaceId: true, name: true, scopes: true, revokedAt: true },
            where: { keyHash: hashKey(key) },
        })
        if (row?.revokedAt) throw new ApiKeysError({ code: ApiKeysErrorCode.Revoked })
        if (!row?.id || !row.workspaceId) throw new ApiKeysError({ code: ApiKeysErrorCode.Unauthorized })
        return { keyId: row.id, workspaceId: row.workspaceId, name: row.name ?? "", scopes: row.scopes ?? [] }
    }

    /**
     * Establishes the agent an MCP endpoint request acts as: the bearer key must work and be bound to an active agent of its
     * workspace with the `tools:call` scope. A revoked key, a public API key and the key of a deleted or paused agent are refused.
     */
    async verifyAgentKey(authorization: string): Promise<AgentKeyPrincipal> {
        const key = bearerKey(authorization)
        if (key === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.Unauthorized })
        const row = await this.entityManager
            .createQueryBuilder(ApiKeyEntity, "k")
            .select("k.id", "id")
            .addSelect("k.workspaceId", "workspace_id")
            .addSelect("k.agentId", "agent_id")
            .addSelect("k.scopes", "scopes")
            .addSelect("k.revokedAt IS NOT NULL", "revoked")
            .where("k.keyHash = :keyHash", { keyHash: hashKey(key) })
            .limit(1)
            .getRawOne<Omit<AgentKeyAnswer, "agent_status">>()
        const status = row?.agent_id == null ? null : await this.agents.statusOf(row.workspace_id, row.agent_id)
        const admitted = admitAgentKey(row === undefined ? undefined : { ...row, agent_status: status })
        if (admitted.kind === "refused") throw new ApiKeysError({ code: admitted.code, params: admitted.params })
        return admitted.value
    }

    /** The keys of a workspace, newest first, for an owner or manager of it. */
    async listKeys(principalId: string, workspaceId: string): Promise<Array<ApiKeyView>> {
        await this.requireManager(this.entityManager, principalId, workspaceId)
        const rows = await this.entityManager.find(ApiKeyEntity, {
            where: { workspaceId },
            order: { createdAt: "DESC" },
            take: 100,
        })
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
            const active = await tx.count(ApiKeyEntity, { where: { workspaceId, revokedAt: IsNull() } })
            if (active >= ACTIVE_KEYS_MAX) {
                throw new ApiKeysError({ code: ApiKeysErrorCode.LimitReached, params: { limit: ACTIVE_KEYS_MAX } })
            }
            const built = buildKey(randomBytes(KEY_ENTROPY_BYTES))
            const values = {
                workspaceId,
                name: named.value,
                keyPrefix: built.prefix,
                keyHash: built.hash,
                createdBy: principalId,
            }
            // An agent key holds its agent row (FOR SHARE) while it is inserted, so the agent cannot be deleted in between.
            if (agentId !== undefined && !(await this.holdsAgent(tx, workspaceId, agentId))) {
                throw new ApiKeysError({ code: ApiKeysErrorCode.AgentNotFound })
            }
            const inserted = await tx
                .createQueryBuilder(ApiKeyEntity, "ak")
                .insert()
                .values(agentId === undefined ? values : { ...values, agentId, scopes: [TOOLS_CALL_SCOPE] })
                .returning(RETURNED)
                .execute()
            const [row] = returnedKeys(inserted.raw)
            if (row === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.NotCreated })
            await this.events.record(
                {
                    workspaceId,
                    kind: "api.key_created",
                    actor: member.displayName,
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
            const revoked = await tx
                .createQueryBuilder(ApiKeyEntity, "ak")
                .update()
                .set({ revokedAt: () => "now()" })
                .where("id = :keyId AND workspace_id = :workspaceId AND revoked_at IS NULL", { keyId, workspaceId })
                .returning(RETURNED)
                .execute()
            const [row] = returnedKeys(revoked.raw)
            if (row === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.NotFound })
            await this.events.record(
                {
                    workspaceId,
                    kind: "api.key_revoked",
                    actor: member.displayName,
                    summary: `API key revoked: ${row.name}`,
                    evidence: row.keyPrefix,
                },
                tx,
            )
            return toView(row)
        })
    }

    private holdsAgent(manager: EntityManager, workspaceId: string, agentId: string): Promise<boolean> {
        return this.agents.holds(workspaceId, agentId, manager)
    }

    private async requireManager(
        manager: EntityManager,
        principalId: string,
        workspaceId: string,
    ): Promise<MemberFacts> {
        const member = await this.seats.activeSeatOfUser(workspaceId, principalId, manager)
        if (member === null || !mayManageKeys(member.role)) {
            throw new ApiKeysError({ code: ApiKeysErrorCode.NotManager })
        }
        return member
    }
}
