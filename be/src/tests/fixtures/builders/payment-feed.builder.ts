import { createHash } from "node:crypto"
import type { EntityManager } from "typeorm"
import { agentConnectionsEntities } from "@modules/domain/agent-connections"
import type { ConnectionsService } from "@modules/domain/connections"
import { moduleInstallationsEntities } from "@modules/domain/module-installations"
import { persistGraphTenant } from "./agent-graph-world.builder"

const [AgentConnectionEntity] = agentConnectionsEntities
const [ModuleInstallationEntity] = moduleInstallationsEntities

/** The identities of one workspace whose SePay bank feed is bound to its accounting agent. */
export interface PaymentFeedWorld {
    readonly workspaceId: string
    readonly userId: string
    readonly agentId: string
    readonly connectionId: string
    /** The key the owner pastes into SePay: only its digest is stored. */
    readonly webhookKey: string
    /** The bank account the connection stores in full. */
    readonly accountNumber: string
}

/**
 * Persists the owner, the workspace, an accounting agent installed on autopilot and a live SePay money connection whose webhook key
 * digest is stored the way the wizard stores it, bound to the agent for its bank feed.
 */
export const persistPaymentFeed = async (
    manager: EntityManager,
    connections: ConnectionsService,
    world: PaymentFeedWorld,
): Promise<void> => {
    await persistGraphTenant(manager, {
        workspaceId: world.workspaceId,
        userId: world.userId,
        agentId: world.agentId,
        versionId: world.agentId,
    })
    await manager.insert(ModuleInstallationEntity, {
        workspaceId: world.workspaceId,
        moduleKey: "accounting",
        agentId: world.agentId,
        name: "Ke toan AI",
        status: "live",
        operatingMode: "autopilot",
        liveEnabled: true,
    })
    await connections.create({
        id: world.connectionId,
        workspaceId: world.workspaceId,
        createdBy: world.userId,
        provider: "sepay",
        name: "SePay MB",
        status: "connected",
        environment: "live",
        meta: { account_number: world.accountNumber, bank_code: "MB" },
        secret: { plain: "api-token", webhookSecret: createHash("sha256").update(world.webhookKey).digest("hex") },
    })
    await manager.insert(AgentConnectionEntity, {
        agentId: world.agentId,
        connectionId: world.connectionId,
        workspaceId: world.workspaceId,
        purpose: "bank_feed",
        access: "auto",
    })
}
