import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AbilityMode,
    AbilityTickChange,
    AbilityTicks,
    ProviderAttachmentRecord,
    ProviderAttachmentView,
} from "./mcp-tool-grants.contracts"
import { McpConnectorAccessEntity, McpDefaultAccountEntity } from "./persistence/entities"

/** The most attachments one read answers. */
const ACCESS_LIMIT = 500

/** What attaching came to: a row was written, the agent already held one (left as it is), or the agent is not of the workspace. */
export type AttachOutcome = "attached" | "held" | "unknown_agent"

/** What ticking came to: the row was changed, or the agent is not attached to the provider. */
export type TickOutcome = "set" | "not_attached"

/** The modes a stored row may hold. */
const isMode = (value: unknown): value is AbilityMode => value === "auto" || value === "ask"

/** The ticks of a stored row: only well-formed entries count, so a damaged value grants nothing. */
const ticksOf = (stored: unknown): AbilityTicks =>
    typeof stored === "object" && stored !== null && !Array.isArray(stored)
        ? Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, AbilityMode] => isMode(entry[1])))
        : {}

const viewOf = (row: McpConnectorAccessEntity): ProviderAttachmentView => ({
    agentId: row.agentId,
    connectionId: row.connectionId,
    provider: row.provider,
    abilities: ticksOf(row.abilities),
})

const pairKey = (agentId: string, connectionId: string): string => `${agentId}:${connectionId}`

@Injectable()
/**
 * The attachments of agents to the accounts a workspace connected (one connection each), each with the abilities ticked: the one
 * reader and writer of public.mcp_connector_access and public.mcp_default_accounts, and the one place that right is stored. A row is
 * an attachment to one account; a key of its `abilities` is a tick. What
 * an ability is and how a call is judged against a tick are the gateway's catalogue and policy; this capability keeps the rows.
 */
export class McpConnectorAccessService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly agents: AgentDirectoryService,
    ) {}

    /** The attachments of one agent. */
    async listOfAgent(workspaceId: string, agentId: string): Promise<ReadonlyArray<ProviderAttachmentView>> {
        const rows = await this.entityManager.find(McpConnectorAccessEntity, {
            where: { workspaceId, agentId },
            order: { provider: "ASC", connectionId: "ASC" },
            take: ACCESS_LIMIT,
        })
        return rows.map(viewOf)
    }

    /** Every attachment of a workspace, by provider then agent. */
    async listOfWorkspace(workspaceId: string): Promise<ReadonlyArray<ProviderAttachmentView>> {
        const rows = await this.entityManager.find(McpConnectorAccessEntity, {
            where: { workspaceId },
            order: { provider: "ASC", connectionId: "ASC", agentId: "ASC" },
            take: ACCESS_LIMIT,
        })
        return rows.map(viewOf)
    }

    /**
     * Attaches an agent to a provider with the abilities given. An agent that already holds the attachment keeps it exactly as it is
     * (`held`): its ticks are the workspace's and attaching again never rewrites them. Nothing is written for an agent of another workspace.
     */
    async attach(record: ProviderAttachmentRecord, updatedBy: string | null): Promise<AttachOutcome> {
        const owned = await this.agents.cardsOf(record.workspaceId, [record.agentId])
        if (owned.length === 0) return "unknown_agent"
        const held = await this.entityManager.findOne(McpConnectorAccessEntity, {
            select: { id: true },
            where: { workspaceId: record.workspaceId, agentId: record.agentId, connectionId: record.connectionId },
        })
        if (held !== null) return "held"
        await this.entityManager.insert(McpConnectorAccessEntity, {
            workspaceId: record.workspaceId,
            agentId: record.agentId,
            connectionId: record.connectionId,
            provider: record.provider,
            abilities: { ...record.abilities },
            updatedBy,
        })
        return "attached"
    }

    /** Detaches an agent from a provider: the row and every tick on it go. False when there was none. */
    async detach(workspaceId: string, agentId: string, connectionId: string): Promise<boolean> {
        const removed = await this.entityManager.delete(McpConnectorAccessEntity, { workspaceId, agentId, connectionId })
        return (removed.affected ?? 0) > 0
    }

    /** Detaches an agent from every account: an agent that was removed holds no right. Answers how many attachments went. */
    async detachAgent(workspaceId: string, agentId: string): Promise<number> {
        const removed = await this.entityManager.delete(McpConnectorAccessEntity, { workspaceId, agentId })
        return removed.affected ?? 0
    }

    /** Ticks an ability in a mode, changes its mode, or unticks it (mode null), on an attachment that exists. */
    async setAbility(change: AbilityTickChange): Promise<TickOutcome> {
        return this.entityManager.transaction(async (tx) => {
            const row = await tx.findOne(McpConnectorAccessEntity, {
                where: { workspaceId: change.workspaceId, agentId: change.agentId, connectionId: change.connectionId },
                lock: { mode: "pessimistic_write" },
            })
            if (row === null) return "not_attached"
            const kept = Object.entries(ticksOf(row.abilities)).filter(([ability]) => ability !== change.ability)
            const abilities: AbilityTicks = Object.fromEntries(
                change.mode === null ? kept : [...kept, [change.ability, change.mode]],
            )
            await tx.update(McpConnectorAccessEntity, { id: row.id }, { abilities, updatedBy: change.updatedBy })
            return "set"
        })
    }

    /**
     * Creates the attachments that do not exist yet (a template's defaults) and leaves every existing one as the workspace holds it,
     * ticks included: a default never adds to, removes from or changes a row that is there. A record whose agent is not of its workspace
     * is skipped. Answers the attachments created.
     */
    async insertMissing(
        records: ReadonlyArray<ProviderAttachmentRecord>,
        updatedBy: string | null = null,
    ): Promise<ReadonlyArray<ProviderAttachmentRecord>> {
        const wanted = await this.owned(records)
        if (wanted.length === 0) return []
        const existing = await this.entityManager.find(McpConnectorAccessEntity, {
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
            McpConnectorAccessEntity,
            missing.map((record) => ({
                workspaceId: record.workspaceId,
                agentId: record.agentId,
                connectionId: record.connectionId,
                provider: record.provider,
                abilities: { ...record.abilities },
                updatedBy,
            })),
        )
        return missing
    }

    /** The connection a workspace named as its default account of a kind, or null when it named none. */
    async defaultAccountOf(workspaceId: string, kind: string): Promise<string | null> {
        const row = await this.entityManager.findOne(McpDefaultAccountEntity, {
            select: { connectionId: true },
            where: { workspaceId, kind },
        })
        return row?.connectionId ?? null
    }

    /** Names the workspace's default account of a kind: one per workspace and kind, the newer choice replacing the older. */
    async setDefaultAccount(workspaceId: string, kind: string, connectionId: string, updatedBy: string): Promise<void> {
        await this.entityManager.upsert(
            McpDefaultAccountEntity,
            { workspaceId, kind, connectionId, updatedBy },
            ["workspaceId", "kind"],
        )
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
