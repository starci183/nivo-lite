import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionEntity } from "@modules/domain/connections/persistence/entities"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ProviderAttachmentRecord, ProviderAttachmentView } from "./tool-grants.contracts"
import { AccountAttachmentEntity } from "./persistence/entities"

/** The most attachments one read answers. */
const ACCESS_LIMIT = 500

/** What making an attachment the default came to: it is now the agent's default of its provider, or the agent holds no such attachment. */
export type DefaultOutcome = "set" | "not_attached"

/** What attaching came to: a row was written, the agent already held one (left as it is), or the agent is not of the workspace. */
export type AttachOutcome = "attached" | "held" | "unknown_agent"

const viewOf = (row: AccountAttachmentEntity): ProviderAttachmentView => ({
    agentId: row.agentId,
    connectionId: row.connectionId,
    provider: row.provider,
    ...(row.isDefault === true ? { isDefault: true } : {}),
})

const pairKey = (agentId: string, connectionId: string): string => `${agentId}:${connectionId}`

@Injectable()
/**
 * The attachments of agents to the accounts a workspace connected (one connection each): the one reader and writer of
 * public.mcp_connector_access, and the one place that hard right is stored (nivo-frame `rights`). A row is an attachment to one account,
 * nothing more: no tick, no mode (a call's mode is its node's). Detaching is the kill switch; this capability keeps the rows.
 */
export class AccountAttachmentsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly agents: AgentDirectoryService,
    ) {}

    /** The attachments of one agent. */
    async listOfAgent(workspaceId: string, agentId: string): Promise<ReadonlyArray<ProviderAttachmentView>> {
        const rows = await this.entityManager.find(AccountAttachmentEntity, {
            where: { workspaceId, agentId },
            order: { provider: "ASC", connectionId: "ASC" },
            take: ACCESS_LIMIT,
        })
        return this.onLiveAccounts(workspaceId, rows)
    }

    /** The workspaces that hold at least one attachment, in id order, at most `limit`: where an agent has any right on an account. */
    async workspacesAttached(limit: number): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager
            .createQueryBuilder(AccountAttachmentEntity, "a")
            .select("a.workspace_id", "workspace_id")
            .distinct(true)
            .orderBy("a.workspace_id", "ASC")
            .limit(limit)
            .getRawMany<{ readonly workspace_id: string }>()
        return rows.map((row) => row.workspace_id)
    }

    /** Every attachment of a workspace, by provider then agent. */
    async listOfWorkspace(workspaceId: string): Promise<ReadonlyArray<ProviderAttachmentView>> {
        const rows = await this.entityManager.find(AccountAttachmentEntity, {
            where: { workspaceId },
            order: { provider: "ASC", connectionId: "ASC", agentId: "ASC" },
            take: ACCESS_LIMIT,
        })
        return this.onLiveAccounts(workspaceId, rows)
    }

    /**
     * The attachments whose account is still connected (owner ruling R36: a removed provider account is a soft delete, its rows stay and
     * every read hides them): an agent attached to a removed account holds no right on it, so the tool door answers its typed
     * `not_attached` refusal instead of handing a call an account that has no secret any more. The connection read leaves a removed row
     * out by its delete column.
     */
    private async onLiveAccounts(
        workspaceId: string,
        rows: ReadonlyArray<AccountAttachmentEntity>,
    ): Promise<ReadonlyArray<ProviderAttachmentView>> {
        if (rows.length === 0) return []
        const live = await this.entityManager.find(ConnectionEntity, {
            select: { id: true },
            where: { workspaceId, id: In([...new Set(rows.map((row) => row.connectionId))]) },
        })
        const liveIds = new Set(live.map((connection) => connection.id))
        return rows.filter((row) => liveIds.has(row.connectionId)).map((row) => viewOf(row))
    }

    /**
     * Attaches an agent to a connected account. An agent that already holds the attachment keeps it exactly as it is (`held`). Nothing is
     * written for an agent of another workspace.
     */
    async attach(record: ProviderAttachmentRecord, updatedBy: string | null): Promise<AttachOutcome> {
        const owned = await this.agents.cardsOf(record.workspaceId, [record.agentId])
        if (owned.length === 0) return "unknown_agent"
        const held = await this.entityManager.findOne(AccountAttachmentEntity, {
            select: { id: true },
            where: { workspaceId: record.workspaceId, agentId: record.agentId, connectionId: record.connectionId },
        })
        if (held !== null) return "held"
        await this.entityManager.insert(AccountAttachmentEntity, {
            workspaceId: record.workspaceId,
            agentId: record.agentId,
            connectionId: record.connectionId,
            provider: record.provider,
            updatedBy,
        })
        return "attached"
    }

    /**
     * Makes the agent's attachment to an account the agent's DEFAULT account of its provider: the attachment that held the default of
     * that provider before loses it, in the same transaction (at most one default per agent and provider: a partial unique index).
     * Making the default again is a no-op. `not_attached` when the agent holds no attachment to the account (nothing is written).
     * Detaching the default removes its row, so a detached account is never a default.
     */
    async setDefault(
        workspaceId: string,
        agentId: string,
        connectionId: string,
        updatedBy: string | null,
    ): Promise<DefaultOutcome> {
        return this.entityManager.transaction(async (scoped): Promise<DefaultOutcome> => {
            const held = await scoped.findOne(AccountAttachmentEntity, { where: { workspaceId, agentId, connectionId } })
            if (held === null) return "not_attached"
            if (held.isDefault) return "set"
            await scoped.update(
                AccountAttachmentEntity,
                { workspaceId, agentId, provider: held.provider, isDefault: true },
                { isDefault: false, updatedBy },
            )
            await scoped.update(AccountAttachmentEntity, { id: held.id }, { isDefault: true, updatedBy })
            return "set"
        })
    }

    /** Detaches an agent from an account: the kill switch. False when there was none. */
    async detach(workspaceId: string, agentId: string, connectionId: string): Promise<boolean> {
        const removed = await this.entityManager.delete(AccountAttachmentEntity, { workspaceId, agentId, connectionId })
        return (removed.affected ?? 0) > 0
    }

    /** Detaches an agent from every account: an agent that was removed holds no right. Answers how many attachments went. */
    async detachAgent(workspaceId: string, agentId: string): Promise<number> {
        const removed = await this.entityManager.delete(AccountAttachmentEntity, { workspaceId, agentId })
        return removed.affected ?? 0
    }

    /**
     * Creates the attachments that do not exist yet (a template's defaults) and leaves every existing one as the workspace holds it: a
     * default never removes or changes a row that is there. A record whose agent is not of its workspace
     * is skipped. Answers the attachments created.
     */
    async insertMissing(
        records: ReadonlyArray<ProviderAttachmentRecord>,
        updatedBy: string | null = null,
    ): Promise<ReadonlyArray<ProviderAttachmentRecord>> {
        const wanted = await this.owned(records)
        if (wanted.length === 0) return []
        const existing = await this.entityManager.find(AccountAttachmentEntity, {
            select: { agentId: true, connectionId: true },
            where: { agentId: In([...new Set(wanted.map((record) => record.agentId))]) },
            take: ACCESS_LIMIT,
        })
        const held = new Set(existing.map((row) => pairKey(row.agentId, row.connectionId)))
        const missing = [
            ...new Map(
                wanted
                    .filter((record) => !held.has(pairKey(record.agentId, record.connectionId)))
                    .map((record) => [pairKey(record.agentId, record.connectionId), record]),
            ).values(),
        ]
        if (missing.length === 0) return []
        await this.entityManager.insert(
            AccountAttachmentEntity,
            missing.map((record) => ({
                workspaceId: record.workspaceId,
                agentId: record.agentId,
                connectionId: record.connectionId,
                provider: record.provider,
                updatedBy,
            })),
        )
        return missing
    }

    /** The records whose agent belongs to the record's own workspace. */
    private async owned(
        records: ReadonlyArray<ProviderAttachmentRecord>,
    ): Promise<ReadonlyArray<ProviderAttachmentRecord>> {
        const workspaces = [...new Set(records.map((record) => record.workspaceId))]
        const owned = await Promise.all(
            workspaces.map(async (workspaceId) => {
                const agentIds = [
                    ...new Set(records.filter((record) => record.workspaceId === workspaceId).map((r) => r.agentId)),
                ]
                return (await this.agents.cardsOf(workspaceId, agentIds)).map((card) => `${workspaceId}:${card.id}`)
            }),
        )
        const keys = new Set(owned.flat())
        return records.filter((record) => keys.has(`${record.workspaceId}:${record.agentId}`))
    }
}
