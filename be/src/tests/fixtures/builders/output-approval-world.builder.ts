import type { EntityManager } from "typeorm"
import { agentGraphsEntities } from "@modules/domain/agent-graphs"
import { approvalRequestsEntities } from "@modules/domain/approval-requests"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { agentsEntities } from "@modules/domain/agents"
import { agentConversationsEntities } from "@modules/domain/agent-conversations"
import { agentMessagesEntities } from "@modules/domain/agent-messages"
import { moduleInstallationsEntities } from "@modules/domain/module-installations"
import { OWNER_EXAMPLE, graphOf } from "./agent-graph.builder"
import { persistGraph } from "./agent-graph-world.builder"

/** The actual installation and customer turn whose output the person reviews. */
export interface OutputApprovalIdentity {
    readonly workspaceId: string
    readonly agentId: string
    readonly conversationId: string
    readonly customerMessageId: string
    readonly installationId: string
}

/** Creates the actual chatbot installation and its customer message with all database constraints enabled. */
export const persistOutputProofTurn = async (manager: EntityManager, who: OutputApprovalIdentity): Promise<void> => {
    const [AgentEntity] = agentsEntities
    const [ConversationEntity] = agentConversationsEntities
    const [MessageEntity] = agentMessagesEntities
    const [InstallationEntity] = moduleInstallationsEntities
    await manager.update(AgentEntity, { id: who.agentId }, { module: "chatbot" })
    await manager.insert(InstallationEntity, {
        id: who.installationId,
        workspaceId: who.workspaceId,
        agentId: who.agentId,
        moduleKey: "chatbot",
        name: "Output proof",
        status: "live",
        operatingMode: "autopilot",
        liveEnabled: true,
    })
    await manager.insert(ConversationEntity, {
        id: who.conversationId,
        workspaceId: who.workspaceId,
        agentId: who.agentId,
        installationId: who.installationId,
        kind: "customer",
        channel: "website",
    })
    await manager.insert(MessageEntity, {
        id: who.customerMessageId,
        workspaceId: who.workspaceId,
        conversationId: who.conversationId,
        role: "user",
        body: "Place one order after approval",
    })
}

/** Switches only the proof conversation between its website and external-channel delivery boundary. */
export const setOutputProofChannel = async (
    manager: EntityManager,
    conversationId: string,
    external: boolean,
): Promise<void> => {
    const [ConversationEntity] = agentConversationsEntities
    await manager.update(
        ConversationEntity,
        { id: conversationId },
        {
            channel: external ? "telegram" : "website",
            externalId: external ? "proof-recipient" : null,
        },
    )
}

/** One held call, used unchanged by the real registration and queue recovery proofs. */
export const outputApprovalRequestOf = (who: OutputApprovalIdentity, wakeId: string, dedupeKey: string) => ({
    spec: {
        action: "gateway_call",
        subject_type: "conversation" as const,
        subject_id: who.conversationId,
        installationId: who.installationId,
        dedupeKey,
        preset: true,
        noChain: true,
        forceAsk: "over_authority" as const,
        seed: {
            summary: "Place order",
            draft: "Ten units",
            fields: {
                tool: "proof.order.place",
                args_json: '{"qty":10}',
                conversation_id: who.conversationId,
                agent_id: who.agentId,
                in_run: "true",
            },
        },
    },
    wait: {
        wakeId,
        calls: [{ tool: "proof.order.place", argsJson: '{"qty":10}' }],
        scope: {
            conversationId: who.conversationId,
            messageId: who.customerMessageId,
            approvedBy: null,
            workItemId: null,
            planned: "Ten units",
            declined: false,
            outputNode: "output",
            approvalNode: "approval",
            replyNode: "reply",
        },
    },
})

/** Ids supplied by the proof world, rather than ambient randomness inside a fixture. */
export interface OutputGraphStopIds {
    readonly versionId: string
    readonly requestId: string
    readonly chainStepId: string
}

/** Persists a published stop branch and its pending request against the exact work item. */
export const persistOutputGraphStop = async (
    manager: EntityManager,
    who: OutputApprovalIdentity,
    ids: OutputGraphStopIds,
    itemId: string,
): Promise<void> => {
    const [, , , , GraphDecisionEntity] = agentGraphsEntities
    const [ApprovalRequestEntity] = approvalRequestsEntities
    const [MemberEntity] = workspaceMembersEntities
    const member = await manager.findOneOrFail(MemberEntity, {
        where: { workspaceId: who.workspaceId, role: "owner" },
    })
    const base = graphOf(OWNER_EXAMPLE)
    const document = {
        ...base,
        nodes: base.nodes.map((node) =>
            node.decide === undefined
                ? node
                : {
                      ...node,
                      decide: {
                          ...node.decide,
                          intent: "gateway_call",
                          branches: node.decide.branches.map((branch) =>
                              branch.approver === null
                                  ? branch
                                  : {
                                        ...branch,
                                        approver: { ...branch.approver, onTimeout: { kind: "stop" as const } },
                                    },
                          ),
                      },
                  },
        ),
    }
    await persistGraph(
        manager,
        { workspaceId: who.workspaceId, userId: member.userId, agentId: who.agentId, versionId: ids.versionId },
        document,
        "shadow",
        who.installationId,
    )
    await manager.insert(ApprovalRequestEntity, {
        id: ids.requestId,
        chainStepId: ids.chainStepId,
        workspaceId: who.workspaceId,
        department: "chatbot",
        action: "gateway_call",
        unit: "vnd",
        policy: "any",
        requestedByAgentId: who.agentId,
        timeoutMinutes: 1,
        expiresAt: new Date(0),
    })
    await manager.insert(GraphDecisionEntity, {
        workspaceId: who.workspaceId,
        agentId: who.agentId,
        workItemId: itemId,
        versionId: ids.versionId,
        action: "gateway_call",
        branchKey: "middle",
        path: ["decide", "middle"],
        outcome: "ask",
        mode: "enforced",
        facts: {},
        shadowDiff: false,
        approvalRequestId: ids.requestId,
    })
}
