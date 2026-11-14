import { Injectable } from "@nestjs/common"
import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { connectionsEntities } from "@modules/domain/connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { SandboxAccount, SandboxCall, SandboxCallOutcome } from "./provider-sandbox.contracts"
import type { KeptState, ProviderSandboxStore, SandboxCallInput } from "./provider-sandbox-store.port"
import { ProviderSandboxEntryEntity } from "./persistence/entities"

/** The connections entity (the capability exports its entity list only). */
const [ConnectionEntity] = connectionsEntities

/** The most entries one read answers. */
const READ_MAX = 500

/** An entry belongs to a LIVE (not removed) SANDBOX account: every read goes through it (R36: hidden with the account). */
const LIVE_SANDBOX =
    "EXISTS (SELECT 1 FROM public.connections c WHERE c.id = e.connection_id AND c.workspace_id = e.workspace_id AND c.deleted_at IS NULL AND c.sandbox)"

/** A logged call's stored body, read back defensively (a row that is not one is left out). */
const callBodyOf = (body: unknown): { readonly request: unknown; readonly result: SandboxCallOutcome } | null => {
    if (typeof body !== "object" || body === null) return null
    const result: unknown = Reflect.get(body, "result")
    if (typeof result !== "object" || result === null) return null
    const outcome: unknown = Reflect.get(result, "outcome")
    if (outcome === "answered") return { request: Reflect.get(body, "request"), result: { outcome, value: Reflect.get(result, "value") } }
    const error: unknown = Reflect.get(result, "error")
    if (outcome === "threw" && typeof error === "string") return { request: Reflect.get(body, "request"), result: { outcome, error } }
    return null
}

@Injectable()
/** The provider sandbox store on the primary database (role app_be; the workspace is bound in code). */
export class ProviderSandboxStoreService implements ProviderSandboxStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    async accountOf(workspaceId: string, connectionId: string, manager: EntityManager = this.entityManager): Promise<SandboxAccount | null> {
        const row = await this.accounts(manager)
            .where("c.workspaceId = :workspaceId AND c.id = :connectionId", { workspaceId, connectionId })
            .getRawOne<{ id: string; workspaceId: string; provider: string; sandbox: boolean }>()
        return row === undefined ? null : { id: row.id, workspaceId: row.workspaceId, provider: row.provider, sandbox: row.sandbox === true }
    }

    async accountOfId(connectionId: string, manager: EntityManager = this.entityManager): Promise<SandboxAccount | null> {
        const row = await this.accounts(manager)
            .where("c.id = :connectionId", { connectionId })
            .getRawOne<{ id: string; workspaceId: string; provider: string; sandbox: boolean }>()
        return row === undefined ? null : { id: row.id, workspaceId: row.workspaceId, provider: row.provider, sandbox: row.sandbox === true }
    }

    /** The account columns of one connection (a removed one is left out by the entity's delete-date column). */
    private accounts(manager: EntityManager): SelectQueryBuilder<InstanceType<typeof ConnectionEntity>> {
        return manager
            .createQueryBuilder(ConnectionEntity, "c")
            .select("c.id", "id")
            .addSelect("c.workspace_id", "workspaceId")
            .addSelect("c.provider", "provider")
            .addSelect("c.sandbox", "sandbox")
            .limit(1)
    }

    async stateOf(account: SandboxAccount, name: string, key: string): Promise<KeptState | null> {
        const row = await this.entries(account, "state")
            .andWhere("e.operation = :name AND e.key = :key", { name, key })
            .orderBy("e.created_at", "DESC")
            .addOrderBy("e.id", "DESC")
            .limit(1)
            .getRawOne<{ body: unknown }>()
        return row === undefined ? null : { value: row.body }
    }

    async keepState(account: SandboxAccount, name: string, key: string, value: unknown): Promise<void> {
        await this.keep(account, "state", name, key, value ?? null)
    }

    async logCall(account: SandboxAccount, call: SandboxCallInput): Promise<void> {
        await this.keep(account, "call", call.operation, call.key, { request: call.request ?? null, result: call.result })
    }

    async countCalls(account: SandboxAccount, operation: string): Promise<number> {
        return await this.entries(account, "call").andWhere("e.operation = :operation", { operation }).getCount()
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
            const body = callBodyOf(row.body)
            return body === null
                ? []
                : [{ id: row.id, operation: row.operation, key: row.key, request: body.request, result: body.result, at: new Date(row.at).toISOString() }]
        })
    }

    async reset(account: SandboxAccount): Promise<void> {
        await this.entityManager
            .createQueryBuilder()
            .delete()
            .from(ProviderSandboxEntryEntity)
            .where("workspace_id = :workspaceId AND connection_id = :connectionId", { workspaceId: account.workspaceId, connectionId: account.id })
            .execute()
    }

    private async keep(account: SandboxAccount, kind: "state" | "call", operation: string, key: string, body: unknown): Promise<void> {
        await this.entityManager
            .createQueryBuilder(ProviderSandboxEntryEntity, "e")
            .insert()
            .values({ workspaceId: account.workspaceId, connectionId: account.id, kind, operation, key, body: () => ":body::jsonb" })
            .setParameter("body", JSON.stringify(body))
            .execute()
    }

    private entries(account: SandboxAccount, kind: "state" | "call"): SelectQueryBuilder<ProviderSandboxEntryEntity> {
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
