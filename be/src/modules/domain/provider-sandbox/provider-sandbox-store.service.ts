import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { connectionsEntities } from "@modules/domain/connections"
import { InjectPrimaryEntityManager, returnedRows, rowShape } from "@modules/platform/database"
import type { SandboxAccount, SandboxCall, SandboxScriptOutcome } from "./provider-sandbox.contracts"
import { callBodySchema, scriptOutcomeSchema } from "./provider-sandbox.policy"
import type { FoundFixture, ProviderSandboxStore, SandboxEntryInput } from "./provider-sandbox-store.port"
import { ProviderSandboxEntryEntity } from "./persistence/entities"

/** The connections entity (the capability exports its entity list only). */
const [ConnectionEntity] = connectionsEntities

/** The most entries one read answers. */
const READ_MAX = 500

/** An entry belongs to a LIVE (not removed) SANDBOX account: every read and the script take go through it (R36: hidden with the account). */
const LIVE_SANDBOX =
    "EXISTS (SELECT 1 FROM public.connections c WHERE c.id = e.connection_id AND c.workspace_id = e.workspace_id AND c.deleted_at IS NULL AND c.sandbox)"

/**
 * Takes one call of the newest script of the operation that has calls left (the exact key before the empty key), in ONE statement: the
 * row is locked, a counted script loses one call, a sticky one (`remaining` null) stays; the script's body is returned.
 */
const TAKE_SCRIPT =
    "WITH picked AS ( " +
    "    SELECT e.id FROM public.provider_sandbox_entries e " +
    "    WHERE e.workspace_id = $1 AND e.connection_id = $2 AND e.kind = 'script' AND e.operation = $3 AND e.key IN ($4, '') " +
    "      AND (e.remaining IS NULL OR e.remaining > 0) " +
    "      AND EXISTS (SELECT 1 FROM public.connections c WHERE c.id = e.connection_id AND c.workspace_id = e.workspace_id AND c.deleted_at IS NULL AND c.sandbox) " +
    "    ORDER BY (e.key = $4) DESC, e.created_at DESC, e.id DESC " +
    "    LIMIT 1 " +
    "    FOR UPDATE OF e SKIP LOCKED " +
    ") " +
    "UPDATE public.provider_sandbox_entries t " +
    "SET remaining = CASE WHEN t.remaining IS NULL THEN NULL ELSE t.remaining - 1 END " +
    "FROM picked WHERE t.id = picked.id " +
    "RETURNING t.body"

@Injectable()
/** The provider sandbox store on the primary database (role app_be; the workspace is bound in code). */
export class ProviderSandboxStoreService implements ProviderSandboxStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    async accountOf(workspaceId: string, connectionId: string, manager: EntityManager = this.entityManager): Promise<SandboxAccount | null> {
        const row = await manager
            .createQueryBuilder(ConnectionEntity, "c")
            .select("c.id", "id")
            .addSelect("c.workspace_id", "workspaceId")
            .addSelect("c.provider", "provider")
            .addSelect("c.sandbox", "sandbox")
            .where("c.workspaceId = :workspaceId AND c.id = :connectionId", { workspaceId, connectionId })
            .limit(1)
            .getRawOne<{ id: string; workspaceId: string; provider: string; sandbox: boolean }>()
        return row === undefined ? null : { id: row.id, workspaceId: row.workspaceId, provider: row.provider, sandbox: row.sandbox === true }
    }

    async keep(account: SandboxAccount, entry: SandboxEntryInput, manager: EntityManager = this.entityManager): Promise<void> {
        await manager
            .createQueryBuilder(ProviderSandboxEntryEntity, "e")
            .insert()
            .values({
                workspaceId: account.workspaceId,
                connectionId: account.id,
                kind: entry.kind,
                operation: entry.operation,
                key: entry.key,
                body: () => ":body::jsonb",
                remaining: entry.remaining,
            })
            .setParameter("body", JSON.stringify(entry.body))
            .execute()
    }

    async takeScript(account: SandboxAccount, operation: string, key: string): Promise<SandboxScriptOutcome | null> {
        const raw: unknown = await this.entityManager.query(TAKE_SCRIPT, [account.workspaceId, account.id, operation, key])
        // node-postgres answers an UPDATE ... RETURNING through TypeORM as [rows, count].
        const rows: unknown = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw
        const [row] = returnedRows(rows, rowShape({ body: "json" }))
        if (row === undefined) return null
        const parsed = scriptOutcomeSchema.safeParse(row.body)
        return parsed.success ? parsed.data : null
    }

    async fixtureOf(account: SandboxAccount, operation: string, key: string): Promise<FoundFixture | null> {
        const row = await this.entries(account, "fixture")
            .andWhere("e.operation = :operation AND e.key IN (:key, '')", { operation, key })
            .orderBy("(e.key = :key)", "DESC")
            .addOrderBy("e.created_at", "DESC")
            .addOrderBy("e.id", "DESC")
            .limit(1)
            .getRawOne<{ body: unknown }>()
        if (row === undefined) return null
        const body: unknown = row.body
        return { value: typeof body === "object" && body !== null ? Reflect.get(body, "value") : null }
    }

    async calls(account: SandboxAccount, operation?: string): Promise<ReadonlyArray<SandboxCall>> {
        const query = this.entries(account, "call")
        if (operation !== undefined) query.andWhere("e.operation = :operation", { operation })
        const rows = await query
            .orderBy("e.created_at", "ASC")
            .addOrderBy("e.id", "ASC")
            .limit(READ_MAX)
            .getRawMany<{ id: string; operation: string; key: string; body: unknown; at: Date }>()
        return rows.flatMap((row) => {
            const body = callBodySchema.safeParse(row.body)
            return body.success
                ? [{ id: row.id, operation: row.operation, key: row.key, request: body.data.request, result: body.data.result, at: new Date(row.at).toISOString() }]
                : []
        })
    }

    async clearPlan(account: SandboxAccount): Promise<void> {
        await this.entityManager
            .createQueryBuilder()
            .delete()
            .from(ProviderSandboxEntryEntity)
            .where("workspace_id = :workspaceId AND connection_id = :connectionId AND kind IN ('fixture', 'script')", {
                workspaceId: account.workspaceId,
                connectionId: account.id,
            })
            .execute()
    }

    private entries(account: SandboxAccount, kind: string): SelectQueryBuilder<ProviderSandboxEntryEntity> {
        return this.entityManager
            .createQueryBuilder(ProviderSandboxEntryEntity, "e")
            .select("e.id", "id")
            .addSelect("e.operation", "operation")
            .addSelect("e.key", "key")
            .addSelect("e.body", "body")
            .addSelect("e.created_at", "at")
            .where("e.workspace_id = :workspaceId AND e.connection_id = :connectionId AND e.kind = :kind", {
                workspaceId: account.workspaceId,
                connectionId: account.id,
                kind,
            })
            .andWhere(LIVE_SANDBOX)
    }
}
