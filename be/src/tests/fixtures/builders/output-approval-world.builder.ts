import type { EntityManager } from "typeorm"
import { agentGraphsEntities } from "@modules/domain/agent-graphs"
import { approvalRequestsEntities } from "@modules/domain/approval-requests"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { agentsEntities } from "@modules/domain/agents"
import { entityEngineEntities } from "@modules/domain/entity-engine"
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
    const [RecordEntity] = entityEngineEntities
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
    await manager.insert(RecordEntity, {
        entity: "chat.conversation",
        id: who.conversationId,
        workspaceId: who.workspaceId,
        data: {
            channel: "website",
            name: "",
            status: "ai",
            waiting: false,
            unanswered: false,
            lastText: "",
            messageCount: 0,
            agentId: who.agentId,
        },
    })
    await manager.insert(RecordEntity, {
        entity: "chat.message",
        id: who.customerMessageId,
        workspaceId: who.workspaceId,
        data: {
            conversationId: who.conversationId,
            role: "user",
            text: "Place one order after approval",
            sentAt: "2026-11-06T03:00:00.000Z",
        },
    })
}

type OutputApprovalRequestOfResultWaitScopeShape = {
    conversationId: string
    messageId: string
    approvedBy: null
    workItemId: null
    planned: string
    declined: boolean
    outputNode: string
    approvalNode: string
    replyNode: string
}

type OutputApprovalRequestOfResultWaitCallsShape = {
    tool: string
    argsJson: string
}

type OutputApprovalRequestOfResultWaitShape = {
    wakeId: string
    calls: Array<OutputApprovalRequestOfResultWaitCallsShape>
    scope: OutputApprovalRequestOfResultWaitScopeShape
}

type OutputApprovalRequestOfResultSpecSeedFieldsShape = {
    tool: string
    args_json: string
    conversation_id: string
    agent_id: string
    in_run: string
}

type OutputApprovalRequestOfResultSpecSeedShape = {
    summary: string
    draft: string
    fields: OutputApprovalRequestOfResultSpecSeedFieldsShape
}

type OutputApprovalRequestOfResultSpecShape = {
    action: string
    subject_type: "conversation"
    subject_id: string
    installationId: string
    dedupeKey: string
    preset: boolean
    noChain: boolean
    forceAsk: "over_authority"
    seed: OutputApprovalRequestOfResultSpecSeedShape
}

type OutputApprovalRequestOfResultShape = {
    spec: OutputApprovalRequestOfResultSpecShape
    wait: OutputApprovalRequestOfResultWaitShape
}

/** One held call, used unchanged by the real registration and queue recovery proofs. */
export const outputApprovalRequestOf = (
    who: OutputApprovalIdentity,
    wakeId: string,
    dedupeKey: string,
): OutputApprovalRequestOfResultShape => ({
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
