import { randomBytes } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ApiKeyAuthAnswer, ApiKeyView, ApiPrincipal, ApiScope, CreatedApiKey } from "./api-keys.contracts"
import { ACTIVE_KEYS_MAX, admitKey, bearerKey, buildKey, cleanName, hashKey, mayManageKeys } from "./api-keys.policy"
import { ApiKeysError, ApiKeysErrorCode } from "./errors/api-keys.error"
import type { ApiKeysRow, MemberRow } from "./persistence/api-keys.rows"
import {
    API_KEY_AUTH,
    COUNT_ACTIVE_KEYS,
    INSERT_EVIDENCE,
    INSERT_KEY,
    LIST_KEYS,
    REVOKE_KEY,
    SELECT_MEMBER,
} from "./persistence/api-keys.sql"

/** Bytes of entropy in one key. */
const KEY_ENTROPY_BYTES = 32

type KeyRow = Pick<ApiKeysRow, "id" | "name" | "key_prefix" | "created_at" | "last_used_at" | "revoked_at">
type MemberFacts = Pick<MemberRow, "role" | "display_name">

const toView = (row: KeyRow): ApiKeyView => ({
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
})

@Injectable()
/** The workspace API keys reached only through the shared primary EntityManager. */
export class ApiKeysService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /**
     * Admits a public API request: the bearer key must exist, work, stay inside its minute budget and carry `scope`. The lookup,
     * the rate hit and the last-use stamp are one statement.
     */
    async authenticate(authorization: string | undefined, scope: ApiScope): Promise<ApiPrincipal> {
        const key = bearerKey(authorization)
        if (key === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.Unauthorized })
        const [row] = await this.entityManager.query<Array<{ auth: ApiKeyAuthAnswer | null }>>(API_KEY_AUTH, [
            hashKey(key),
        ])
        const admitted = admitKey(row?.auth ?? null, scope, this.clock.now())
        if (admitted.kind === "refused") throw new ApiKeysError({ code: admitted.code, params: admitted.params })
        return admitted.value
    }

    /** The keys of a workspace, newest first, for an owner or manager of it. */
    async listKeys(principalId: string, workspaceId: string): Promise<Array<ApiKeyView>> {
        await this.requireManager(this.entityManager, principalId, workspaceId)
        const rows = await this.entityManager.query<Array<KeyRow>>(LIST_KEYS, [workspaceId])
        return rows.map(toView)
    }

    /** Creates a key for a workspace; the secret is answered here once because only its hash is stored. */
    async createKey(principalId: string, workspaceId: string, rawName: string): Promise<CreatedApiKey> {
        const named = cleanName(rawName)
        if (named.kind === "refused") throw new ApiKeysError({ code: named.code })
        return this.entityManager.transaction(async (tx) => {
            const member = await this.requireManager(tx, principalId, workspaceId)
            const [count] = await tx.query<Array<{ active: number }>>(COUNT_ACTIVE_KEYS, [workspaceId])
            if ((count?.active ?? 0) >= ACTIVE_KEYS_MAX) {
                throw new ApiKeysError({ code: ApiKeysErrorCode.LimitReached, params: { limit: ACTIVE_KEYS_MAX } })
            }
            const built = buildKey(randomBytes(KEY_ENTROPY_BYTES))
            const [row] = await tx.query<Array<KeyRow>>(INSERT_KEY, [
                workspaceId,
                named.value,
                built.prefix,
                built.hash,
                principalId,
            ])
            if (row === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.NotCreated })
            await tx.query(INSERT_EVIDENCE, [
                workspaceId,
                "api.key_created",
                member.display_name,
                `API key created: ${named.value}`,
                built.prefix,
            ])
            return { key: built.key, item: toView(row) }
        })
    }

    /** Revokes a working key of a workspace: it stops working at once and its row stays as history. */
    async revokeKey(principalId: string, workspaceId: string, keyId: string): Promise<ApiKeyView> {
        return this.entityManager.transaction(async (tx) => {
            const member = await this.requireManager(tx, principalId, workspaceId)
            const [row] = await tx.query<Array<KeyRow>>(REVOKE_KEY, [workspaceId, keyId])
            if (row === undefined) throw new ApiKeysError({ code: ApiKeysErrorCode.NotFound })
            await tx.query(INSERT_EVIDENCE, [
                workspaceId,
                "api.key_revoked",
                member.display_name,
                `API key revoked: ${row.name}`,
                row.key_prefix,
            ])
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
