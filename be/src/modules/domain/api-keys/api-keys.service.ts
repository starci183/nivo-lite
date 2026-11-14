import { Injectable } from "@nestjs/common"
import {
    ApiKeyVerifier,
    AUTH_ERROR_CODES,
    AuthError,
    issueApiKey,
    type ApiKeyRecord,
    type ApiKeyStore,
} from "@modules/integrations/passport"
import { IsNull, type EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMemberSeatsService, type MemberSeatRecord } from "@modules/domain/workspace-members"
import { AgentDirectoryService } from "@modules/domain/agents"
import type {
    ApiKeyAuthAnswer,
    ApiKeyKind,
    ApiKeyScope,
    ApiKeyView,
    ApiPrincipal,
    ApiScope,
    CreatedApiKey,
    McpKeyFacts,
    McpKeyPrincipal,
} from "./api-keys.contracts"
import {
    ACTIVE_KEYS_MAX,
    admitMcpKey,
    cleanName,
    displayPrefix,
    inactiveReasonOf,
    KEY_PREFIX,
    kindOfScopes,
    MCP_SCOPE,
    mayManageKeys,
    refusalOfVerify,
    requireScope,
    withinMinuteBudget,
} from "./api-keys.policy"
import type { ApiKeysOptions } from "./api-keys.options"
import { InjectApiKeysOptions } from "./api-keys.port"
import { ApiKeysError, ApiKeysErrorCode } from "./errors/api-keys.error"
import { ApiKeyEntity } from "./persistence/entities"

/** A key id is the row id: a uuid, checked before the table is asked (a uuid column refuses any other text). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** The most keys one listing answers. */
const LIST_MAX = 100

/** The most seats read to name the holders of one listing (a workspace's seats are bounded well below it). */
const HOLDERS_MAX = 500

/** The columns a write answers, named as the entity properties so the answer reads as an entity. */
const RETURNED =
    'id, name, key_prefix AS "keyPrefix", scopes, created_by AS "createdBy", created_at AS "createdAt", last_used_at AS "lastUsedAt", revoked_at AS "revokedAt", agent_id AS "agentId"'

/** True when a RETURNING row carries the key shape the returned columns give it. */
const isApiKeyEntity = (value: unknown): value is ApiKeyEntity =>
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"

/** The rows a write answered. */
const returnedKeys = (raw: unknown): Array<ApiKeyEntity> => (Array.isArray(raw) ? raw.filter(isApiKeyEntity) : [])

const iso = (at: Date | null): string | null => (at === null ? null : at.toISOString())

/** The active seats of a listing's holders: account id → seat name and role. */
type HolderSeats = ReadonlyMap<string, { readonly displayName: string; readonly role: string }>

/** The path of the MCP endpoint under the mcp app's public base: the key names its workspace. */
const MCP_ENDPOINT_PATH = "/mcp"

/** The text without its trailing slashes. */
const withoutTrailingSlashes = (text: string): string => {
    let end = text.length
    while (end > 0 && text[end - 1] === "/") end -= 1
    return text.slice(0, end)
}

/** The MCP endpoint of a key of this kind under the public base, or null. */
const endpointOf = (kind: ApiKeyKind, base: string | undefined): string | null =>
    kind === "mcp" && base !== undefined ? `${withoutTrailingSlashes(base)}${MCP_ENDPOINT_PATH}` : null

const toView = (row: ApiKeyEntity, seats: HolderSeats, base: string | undefined): ApiKeyView => ({
    id: row.id,
    name: row.name,
    prefix: row.keyPrefix,
    kind: kindOfScopes(row.scopes),
    holderId: row.createdBy,
    holderName: row.createdBy === null ? null : (seats.get(row.createdBy)?.displayName ?? null),
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: iso(row.lastUsedAt),
    revokedAt: iso(row.revokedAt),
    inactiveReason: inactiveReasonOf({
        kind: kindOfScopes(row.scopes),
        revoked: row.revokedAt !== null,
        holderId: row.createdBy,
        holderRole: row.createdBy === null ? null : (seats.get(row.createdBy)?.role ?? null),
    }),
    agentId: row.agentId,
    endpointUrl: endpointOf(kindOfScopes(row.scopes), base),
})

/** The seats a write's answer carries: the acting member is the only holder it needs to name when it holds the key. */
const actorSeats = (member: MemberSeatRecord): HolderSeats =>
    new Map([[member.userId, { displayName: member.displayName, role: member.role }]])

/** A verified key: its id and what the key table holds of it. */
type VerifiedKey = ApiKeyScope & { readonly keyId: string }

const toPrincipal = (key: VerifiedKey): ApiPrincipal => ({
    keyId: key.keyId,
    workspaceId: key.workspaceId,
    name: key.name,
    scopes: key.scopes,
})

@Injectable()
/**
 * The workspace API keys reached only through the shared primary EntityManager: the admission of a public API request and of an MCP
 * endpoint request, and their management. A key is stored by its SHA-256 only and its secret is answered once, at creation.
 */
export class ApiKeysService {
    /** The `@starci/auth` strategy over this table: `nvk_<id>.<secret>`, the secret proved in constant time against the stored hash. */
    private readonly verifier: ApiKeyVerifier<ApiKeyScope>

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly events: EventsService,
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly agents: AgentDirectoryService,
        @InjectApiKeysOptions() private readonly options: ApiKeysOptions,
    ) {
        const store: ApiKeyStore<ApiKeyScope> = { findApiKey: (keyId) => this.findApiKey(keyId) }
        this.verifier = new ApiKeyVerifier({ store, prefix: KEY_PREFIX })
    }

    /**
     * Admits a public API request: the bearer key must verify (it exists, its secret matches, it is not revoked), carry `scope` and
     * stay inside its minute budget, in that order. The rate hit and the last-use stamp are one statement, made only after the proof.
     */
    async authenticate(scope: ApiScope, authorization: string = ""): Promise<ApiPrincipal> {
        const key = await this.verified(authorization)
        const scoped = requireScope(key.scopes, scope)
        if (scoped.kind === "refused") throw new ApiKeysError({ code: scoped.code, params: scoped.params })
        await this.countCall(key.keyHash)
        return toPrincipal(key)
    }

    /** Establishes a key identity without consuming its per-minute operation budget. */
    async verifyCredential(authorization: string): Promise<ApiPrincipal> {
        return toPrincipal(await this.verified(authorization))
    }

    /**
     * Establishes who an MCP endpoint request acts as: the bearer key must verify (exists, secret matches, not revoked), carry the MCP
     * scope, its holder must STILL be an owner or manager of the key's workspace (the holder's current role, judged at every call: a
     * demoted or departed holder stops the key at once, and promoting them again admits it again) and, for an agent-scoped key, the agent
     * must be active there; the call is then counted against the key's minute budget (which also stamps its last use).
     */
    async verifyMcpKey(authorization: string): Promise<McpKeyPrincipal> {
        const key = await this.verified(authorization)
        const admitted = admitMcpKey(await this.factsOf(key))
        if (admitted.kind === "refused") throw new ApiKeysError({ code: admitted.code, params: admitted.params })
        await this.countCall(key.keyHash)
        return admitted.value
    }

    /**
     * What a working MCP key of a workspace stands for (its holder and its agent scope), by the id its admission proved; null when the
     * key was revoked since, is no MCP key or has no holder. The holder's seat and role are judged by every operation.
     */
    async heldMcpKey(workspaceId: string, keyId: string): Promise<McpKeyPrincipal | null> {
        const row = await this.entityManager.findOne(ApiKeyEntity, {
            select: { id: true, workspaceId: true, createdBy: true, agentId: true, scopes: true },
            where: { id: keyId, workspaceId, revokedAt: IsNull() },
        })
        const holderId = row?.createdBy ?? null
        if (row === null || holderId === null || kindOfScopes(row.scopes) !== "mcp") return null
        return { keyId: row.id, workspaceId: row.workspaceId, holderId, agentId: row.agentId }
    }

    /**
     * The live PUBLIC API keys scoped to one agent, oldest first: the customer entrances that agent answers (an MCP key is no customer
     * entrance). Reads only; the caller has proved the member.
     */
    async publicKeysOfAgent(
        workspaceId: string,
        agentId: string,
    ): Promise<ReadonlyArray<{ readonly id: string; readonly name: string }>> {
        const rows = await this.entityManager.find(ApiKeyEntity, {
            select: { id: true, name: true, scopes: true },
            where: { workspaceId, agentId, revokedAt: IsNull() },
            order: { createdAt: "ASC" },
            take: LIST_MAX,
        })
        return rows.filter((row) => kindOfScopes(row.scopes) === "public_api").map(({ id, name }) => ({ id, name }))
    }

    /** The keys of a workspace, newest first: an owner or manager only; staff see nothing of the keys block. */
    async listKeys(principalId: string, workspaceId: string): Promise<Array<ApiKeyView>> {
        await this.requireKeyManager(this.entityManager, principalId, workspaceId)
        const rows = await this.entityManager.find(ApiKeyEntity, {
            where: { workspaceId },
            order: { createdAt: "DESC" },
            take: LIST_MAX,
        })
        const seats = await this.seats.activeSeats(workspaceId, HOLDERS_MAX)
        const held: HolderSeats = new Map(seats.map((seat) => [seat.userId, seat]))
        return rows.map((row) => toView(row, held, this.options.mcpPublicUrl))
    }

    /**
     * Creates a key for a workspace; the secret is answered here once because only its hash is stored. Every key is created by an
     * owner or manager. An MCP key runs as that member (its holder); with an agent it is scoped to that agent of the workspace. A public
     * API key carries the public API scopes; with an agent it is scoped to that agent, which then owns the
     * conversations the key opens (without one, the workspace's customer-chat front door owns them).
     */
    createKey(
        principalId: string,
        workspaceId: string,
        rawName: string,
        kind: ApiKeyKind | undefined,
        agentId?: string,
    ): Promise<CreatedApiKey> {
        const named = cleanName(rawName)
        if (named.kind === "refused") throw new ApiKeysError({ code: named.code })
        return this.entityManager.transaction(async (tx) => {
            const member = await this.requireManager(tx, principalId, workspaceId)
            const active = await tx.count(ApiKeyEntity, { where: { workspaceId, revokedAt: IsNull() } })
            if (active >= ACTIVE_KEYS_MAX) {
                throw new ApiKeysError({ code: ApiKeysErrorCode.LimitReached, params: { limit: ACTIVE_KEYS_MAX } })
            }
            const issued = issueApiKey({ prefix: KEY_PREFIX })
            const keyPrefix = displayPrefix(issued.id)
            const values = {
                id: issued.id,
                workspaceId,
                name: named.value,
                keyPrefix,
                keyHash: issued.secretSha256,
                createdBy: principalId,
            }
            // A scoped key holds its agent row (FOR SHARE) while it is inserted, so the agent cannot be deleted in between.
            if (agentId !== undefined && !(await this.agents.holds(workspaceId, agentId, tx))) {
                throw new ApiKeysError({ code: ApiKeysErrorCode.AgentNotFound })
            }
            const scoped =
                kind === "mcp"
                    ? { ...values, agentId: agentId ?? null, scopes: [MCP_SCOPE] }
                    : { ...values, ...(agentId === undefined ? {} : { agentId }) }
            const inserted = await tx
                .createQueryBuilder(ApiKeyEntity, "ak")
                .insert()
                .values(scoped)
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
                    evidence: keyPrefix,
                },
                tx,
            )
            return { key: issued.key.reveal(), item: toView(row, actorSeats(member), this.options.mcpPublicUrl) }
        })
    }

    /** Renames a working key of a workspace: an owner or manager. */
    renameKey(principalId: string, workspaceId: string, keyId: string, rawName: string): Promise<ApiKeyView> {
        const named = cleanName(rawName)
        if (named.kind === "refused") throw new ApiKeysError({ code: named.code })
        return this.entityManager.transaction(async (tx) => {
            const member = await this.requireKeyManager(tx, principalId, workspaceId)
            const holder = await this.workingKeyHolder(tx, workspaceId, keyId)
            const renamed = await tx
                .createQueryBuilder(ApiKeyEntity, "ak")
                .update()
                .set({ name: named.value })
                .where("id = :keyId AND workspace_id = :workspaceId AND revoked_at IS NULL", { keyId, workspaceId })
                .returning(RETURNED)
                .execute()
            const [row] = returnedKeys(renamed.raw)
            if (row === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.NotFound })
            await this.events.record(
                {
                    workspaceId,
                    kind: "api.key_renamed",
                    actor: member.displayName,
                    summary: `API key renamed: ${named.value}`,
                    evidence: row.keyPrefix,
                },
                tx,
            )
            return toView(row, await this.seatsOf(tx, workspaceId, member, holder), this.options.mcpPublicUrl)
        })
    }

    /** Revokes a working key of a workspace (an owner or manager): it stops working at once, its row stays as history. */
    revokeKey(principalId: string, workspaceId: string, keyId: string): Promise<ApiKeyView> {
        return this.entityManager.transaction(async (tx) => {
            const member = await this.requireKeyManager(tx, principalId, workspaceId)
            const holder = await this.workingKeyHolder(tx, workspaceId, keyId)
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
            return toView(row, await this.seatsOf(tx, workspaceId, member, holder), this.options.mcpPublicUrl)
        })
    }

    /** The verified key of a request: `nvk_<id>.<secret>` proved by the package, a refusal answered as this capability's own error. */
    private async verified(authorization: string): Promise<VerifiedKey> {
        try {
            const principal = await this.verifier.authenticate({ authorization }, this.clock.now())
            return { keyId: principal.keyId, ...principal.scope }
        } catch (error) {
            if (error instanceof AuthError && error.code === AUTH_ERROR_CODES.ApiKeyRejected) {
                throw new ApiKeysError({ code: refusalOfVerify(error.context.reason), cause: error })
            }
            throw error
        }
    }

    /** The store port of the verifier: the row of one key id of the key table (null when the text is no uuid or no row has it). */
    private async findApiKey(keyId: string): Promise<ApiKeyRecord<ApiKeyScope> | null> {
        if (!UUID.test(keyId)) return null
        const row = await this.entityManager.findOne(ApiKeyEntity, {
            select: { id: true, workspaceId: true, name: true, scopes: true, keyHash: true, createdBy: true, agentId: true, revokedAt: true },
            where: { id: keyId },
        })
        if (row === null) return null
        return {
            id: row.id,
            secretSha256: row.keyHash,
            revokedAt: row.revokedAt,
            scope: {
                workspaceId: row.workspaceId,
                name: row.name ?? "",
                scopes: row.scopes ?? [],
                createdBy: row.createdBy,
                agentId: row.agentId,
                keyHash: row.keyHash,
            },
        }
    }

    /** Counts one call of a verified key against its minute budget (and stamps its last use); refused when the minute is used up. */
    private async countCall(keyHash: string): Promise<void> {
        const [hit] = await callDbFunction<{ api_key_auth: ApiKeyAuthAnswer | null }>(
            this.entityManager,
            "public.api_key_auth",
            [keyHash],
        )
        const budget = withinMinuteBudget(hit?.api_key_auth ?? null, this.clock.now())
        if (budget.kind === "refused") throw new ApiKeysError({ code: budget.code, params: budget.params })
    }

    /** The facts the admission of a verified MCP key judges: the role of its holder's active seat (null when none), and its agent's status. */
    private async factsOf(key: VerifiedKey): Promise<McpKeyFacts> {
        const seat = key.createdBy === null ? null : await this.seats.activeSeatOfUser(key.workspaceId, key.createdBy)
        const status = key.agentId === null ? null : await this.agents.statusOf(key.workspaceId, key.agentId)
        return {
            id: key.keyId,
            workspaceId: key.workspaceId,
            createdBy: key.createdBy,
            agentId: key.agentId,
            scopes: key.scopes,
            holderRole: seat === null ? null : seat.role,
            agentStatus: status,
        }
    }

    /** The holder of a working key of the workspace; a key that is revoked or not of the workspace is answered as not found. */
    private async workingKeyHolder(manager: EntityManager, workspaceId: string, keyId: string): Promise<string | null> {
        const row = await manager.findOne(ApiKeyEntity, {
            select: { id: true, createdBy: true },
            where: { id: keyId, workspaceId, revokedAt: IsNull() },
        })
        if (row === null) throw new ApiKeysError({ code: ApiKeysErrorCode.NotFound })
        return row.createdBy
    }

    /** The holder seat one changed key's answer needs. */
    private async seatsOf(
        manager: EntityManager,
        workspaceId: string,
        member: MemberSeatRecord,
        holder: string | null,
    ): Promise<HolderSeats> {
        if (holder === null || holder === member.userId) return actorSeats(member)
        const seat = await this.seats.activeSeatOfUser(workspaceId, holder, manager)
        return seat === null ? new Map() : new Map([[seat.userId, { displayName: seat.displayName, role: seat.role }]])
    }

    /** The seat of an owner or manager; a non-member is refused as such, any other member as not a manager. */
    private async requireKeyManager(
        manager: EntityManager,
        principalId: string,
        workspaceId: string,
    ): Promise<MemberSeatRecord> {
        const member = await this.seats.activeSeatOfUser(workspaceId, principalId, manager)
        if (member === null) throw new ApiKeysError({ code: ApiKeysErrorCode.NotMember })
        if (!mayManageKeys(member.role)) throw new ApiKeysError({ code: ApiKeysErrorCode.NotManager })
        return member
    }

    private async requireManager(
        manager: EntityManager,
        principalId: string,
        workspaceId: string,
    ): Promise<MemberSeatRecord> {
        const member = await this.seats.activeSeatOfUser(workspaceId, principalId, manager)
        if (member === null || !mayManageKeys(member.role)) {
            throw new ApiKeysError({ code: ApiKeysErrorCode.NotManager })
        }
        return member
    }
}
