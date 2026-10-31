import type { EntityManager } from "typeorm"
import { agentGraphsEntities } from "@modules/domain/agent-graphs"
import type { GraphDocument, GraphMode } from "@modules/domain/agent-graphs"
import { agentsEntities } from "@modules/domain/agents"
import { moduleInstallationsEntities } from "@modules/domain/module-installations"
import type { WorkItem } from "@modules/domain/decisions"
import { workItemsEntities } from "@modules/domain/work-items"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { workspacesEntities } from "@modules/domain/workspaces"
import { itemOf } from "./reconcile-payment-performer.builder"

const [AgentGraphEntity, AgentGraphVersionEntity, , , AgentGraphDecisionEntity] = agentGraphsEntities
const [AgentEntity] = agentsEntities
const [ModuleInstallationEntity] = moduleInstallationsEntities
const [WorkItemEntity] = workItemsEntities
const [WorkspaceMemberEntity] = workspaceMembersEntities
const [WorkspaceEntity] = workspacesEntities

/** The agent a graph is given to, with the owner of its workspace and the version it publishes. */
export interface GraphTenant {
    readonly workspaceId: string
    readonly userId: string
    readonly agentId: string
    /** The id of the version published; the world supplies it. */
    readonly versionId: string
}

/** The owner, the workspace (its owner member comes from the workspace trigger) and an accounting agent. */
export const persistGraphTenant = (manager: EntityManager, who: GraphTenant): Promise<void> =>
    manager.transaction(async (tx) => {
        await tx.insert("auth.users", { id: who.userId })
        await tx.insert(WorkspaceEntity, { id: who.workspaceId, ownerId: who.userId, name: "Graph proof" })
        await tx.insert(AgentEntity, {
            id: who.agentId,
            workspaceId: who.workspaceId,
            name: "Ke toan AI",
            handle: `graph-${who.agentId.slice(0, 8)}`,
            module: "accounting",
            role: "Ke toan",
            instructions: "Proof agent.",
        })
    })

/**
 * Gives an agent a graph whose active version is the document, in the mode named, and the accounting installation the graph belongs to
 * (the one named, or a new one). Answers the installation id.
 */
export const persistGraph = (
    manager: EntityManager,
    who: GraphTenant,
    document: GraphDocument,
    mode: GraphMode,
    installationId: string | null = null,
): Promise<string> =>
    manager.transaction(async (tx) => {
        const installed =
            installationId ??
            String(
                (
                    await tx.insert(ModuleInstallationEntity, {
                        workspaceId: who.workspaceId,
                        moduleKey: "accounting",
                        agentId: who.agentId,
                        name: "Ke toan AI",
                        status: "live",
                        operatingMode: "autopilot",
                        liveEnabled: true,
                    })
                ).identifiers[0]?.id,
            )
        const owner = await tx.findOneOrFail(WorkspaceMemberEntity, {
            where: { workspaceId: who.workspaceId, userId: who.userId },
        })
        await tx.insert(AgentGraphEntity, {
            agentId: who.agentId,
            workspaceId: who.workspaceId,
            installationId: installed,
            draft: document,
            draftRev: 1,
            activeVersionId: null,
            mode,
        })
        await tx.insert(AgentGraphVersionEntity, {
            id: who.versionId,
            workspaceId: who.workspaceId,
            agentId: who.agentId,
            version: 1,
            document,
            documentHash: "proof",
            contextVersionId: null,
            changeKind: "edit",
            note: "",
            publishedBy: owner.id,
        })
        await tx.update(AgentGraphEntity, { agentId: who.agentId }, { activeVersionId: who.versionId })
        return installed
    })

/** Starts the graph of an agent over: its recorded decisions removed and its mode set. */
export const restartGraph = async (manager: EntityManager, agentId: string, mode: GraphMode): Promise<void> => {
    await manager.delete(AgentGraphDecisionEntity, { agentId })
    await manager.update(AgentGraphEntity, { agentId }, { mode })
}

/** A supplier-payment work item about a record, as the work engine hands it to the branch decider. */
export const persistPaymentItem = async (
    manager: EntityManager,
    who: GraphTenant,
    action: string,
    record: string,
    dedupeKey: string,
): Promise<WorkItem> => {
    const installation = await manager.findOneOrFail(ModuleInstallationEntity, { where: { agentId: who.agentId } })
    const row = await manager.save(WorkItemEntity, {
        workspaceId: who.workspaceId,
        department: "accounting",
        action,
        subjectType: "invoice",
        subjectId: record,
        dedupeKey,
        proposal: { summary: "Supplier payment", fields: {} },
    })
    return itemOf({
        id: row.id,
        workspace_id: who.workspaceId,
        action,
        subject_type: "invoice",
        subject_id: record,
        installation_id: installation.id,
    })
}
