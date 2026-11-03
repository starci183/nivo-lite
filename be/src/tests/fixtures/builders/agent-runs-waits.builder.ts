import { builder } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { agentGraphsEntities } from "@modules/domain/agent-graphs"
import { approvalRequestsEntities } from "@modules/domain/approval-requests"
import { authorityRulesEntities } from "@modules/domain/authority-rules"
import { moduleInstallationsEntities } from "@modules/domain/module-installations"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { WorkItemsService } from "@modules/domain/work-items"
import type { NewWorkItem, WorkItem } from "@modules/domain/work-items"
import { WorkRecorderService } from "@modules/domain/decisions"
import { branchOf, approverOf, amountIs, graphOf } from "./agent-graph.builder"
import { persistGraph } from "./agent-graph-world.builder"
import { entityOf as authorityRuleOf } from "./authority-rules.builder"
import { entityOf } from "./entity.builder"

const GraphDecisionEntity: (typeof agentGraphsEntities)[4] = agentGraphsEntities[4]
const ApprovalRequestEntity: (typeof approvalRequestsEntities)[0] = approvalRequestsEntities[0]
const AuthorityRuleEntity: (typeof authorityRulesEntities)[0] = authorityRulesEntities[0]
const InstallationEntity: (typeof moduleInstallationsEntities)[0] = moduleInstallationsEntities[0]
const MemberEntity: (typeof workspaceMembersEntities)[0] = workspaceMembersEntities[0]
const ACTION = "send_follow_up"
const SUMMARY = "Engine-extension approval proof"
const RESULT = { summary: "Owner decision committed", evidence: "reviewed" } as const

/** Real application identities supplied by the world, with no synthetic principal. */
export interface WaitsFixtureIdentity {
    readonly workspaceId: string
    readonly agentId: string
    readonly installationId: string
    readonly versionId: string
    readonly ruleId: string
}

/** The graph path whose real timeout the proof selects. */
export type WaitsFixtureBranch = "silence" | "backup"

/** Distinct persisted identities for the timeout request and its chain step. */
export interface WaitsRequestIdentity {
    /** The real approval request row. */
    readonly requestId: string
    /** Its chain step identity. */
    readonly chainStepId: string
}

const queuedItemOf = builder<NewWorkItem>({
    workspaceId: "workspace-1",
    chainId: null,
    depth: 0,
    department: "sales",
    action: ACTION,
    subjectType: "lead",
    subjectId: null,
    leadId: null,
    inboundEventId: null,
    parentId: null,
    dedupeKey: "waits-proof",
    proposal: { summary: SUMMARY, fields: {} },
    installationId: null,
})

const installationOf = entityOf(InstallationEntity, {
    moduleKey: "sales",
    name: "Waits extension proof",
    status: "live",
    operatingMode: "autopilot",
    liveEnabled: true,
})

const requestOf = entityOf(ApprovalRequestEntity, {
    department: "sales",
    action: ACTION,
    unit: "vnd",
    policy: "any",
    timeoutMinutes: 1,
    status: "pending",
    expiresAt: new Date(0),
})

const graphDecisionOf = entityOf(GraphDecisionEntity, {
    action: ACTION,
    outcome: "ask",
    mode: "enforced",
    facts: {},
    shadowDiff: false,
})

/** Seeds actual published timeout branches and the authority rule required to open a real backup request. */
export const persistWaitsFixture = async (manager: EntityManager, who: WaitsFixtureIdentity): Promise<void> => {
    const owner = await manager.findOneOrFail(MemberEntity, {
        where: { workspaceId: who.workspaceId, role: "owner" },
    })
    await manager.insert(
        InstallationEntity,
        installationOf({
            id: who.installationId,
            workspaceId: who.workspaceId,
            agentId: who.agentId,
        }),
    )
    await manager.upsert(
        AuthorityRuleEntity,
        authorityRuleOf({
            id: who.ruleId,
            workspaceId: who.workspaceId,
            department: "sales",
            action: ACTION,
            mode: "ask",
            limitVnd: null,
            requiredFields: [],
            approverRoles: ["owner"],
            agents: [who.agentId],
        }),
        ["workspaceId", "department", "action"],
    )
    const group = { roles: ["owner" as const], rooms: [], members: [] }
    const base = graphOf([
        branchOf({
            key: "silence",
            when: amountIs("lt", 5_000_000),
            then: "ask",
            next: "ask",
            approver: approverOf({ group, onTimeout: { kind: "unset" } }),
        }),
        branchOf({
            key: "backup",
            when: "else",
            then: "ask",
            next: "ask",
            approver: approverOf({ group, onTimeout: { kind: "backup", group } }),
        }),
    ])
    const document = {
        ...base,
        nodes: base.nodes.map((node) => {
            if (node.decide !== undefined) return { ...node, decide: { ...node.decide, intent: ACTION } }
            return node.action === undefined ? node : { ...node, action: ACTION }
        }),
    }
    await persistGraph(
        manager,
        {
            workspaceId: who.workspaceId,
            agentId: who.agentId,
            userId: owner.userId,
            versionId: who.versionId,
        },
        document,
        "enforced",
        who.installationId,
    )
}

/** The work owner's actual queued-to-waiting transition; a lost insert answers null for the world to refuse. */
export const persistWaitsItem = async (
    items: WorkItemsService,
    who: WaitsFixtureIdentity,
    dedupeKey: string,
): Promise<WorkItem | null> => {
    const item = await items.insert(
        queuedItemOf({
            workspaceId: who.workspaceId,
            installationId: who.installationId,
            dedupeKey,
        }),
    )
    if (item === null) return null
    return items.markWaiting(item.id, {
        reason: "over_authority",
        reasons: ["over_authority"],
        missing: [],
        proposal: item.proposal,
        executionId: null,
    })
}

/** Seeds the expired ask the real graph timeout reads; later backup writes are production owner writes. */
export const persistWaitsAsk = async (
    manager: EntityManager,
    who: WaitsFixtureIdentity,
    itemId: string,
    ids: WaitsRequestIdentity,
    branch: WaitsFixtureBranch,
): Promise<void> => {
    await manager.insert(
        ApprovalRequestEntity,
        requestOf({
            id: ids.requestId,
            chainStepId: ids.chainStepId,
            workspaceId: who.workspaceId,
            requestedByAgentId: who.agentId,
        }),
    )
    await manager.insert(
        GraphDecisionEntity,
        graphDecisionOf({
            workspaceId: who.workspaceId,
            agentId: who.agentId,
            workItemId: itemId,
            versionId: who.versionId,
            branchKey: branch,
            path: ["decide", branch],
            approvalRequestId: ids.requestId,
        }),
    )
}

type CommitWaitsDecisionResultShape = {
    name: string
    kind: "owner"
    memberId: string
}

/** Commits the real owner row and decision log together; the caller chooses whether its post-commit callback survives. */
export const commitWaitsDecision = async (
    manager: EntityManager,
    items: WorkItemsService,
    recorder: WorkRecorderService,
    who: WaitsFixtureIdentity,
    item: WorkItem,
    approved: boolean,
): Promise<CommitWaitsDecisionResultShape> => {
    const owner = await manager.findOneOrFail(MemberEntity, {
        where: { workspaceId: who.workspaceId, role: "owner" },
    })
    const by = { name: "Waits proof owner", kind: "owner" as const, memberId: owner.id }
    const ctx = { workspaceId: who.workspaceId, actor: by.name, locale: "en" as const }
    await manager.transaction(async (tx) => {
        if (approved) {
            const done = await items.markDone(
                item.id,
                {
                    path: "human",
                    proposal: item.proposal,
                    result: { summary: RESULT.summary },
                    evidence: RESULT.evidence,
                    leadId: null,
                },
                tx,
            )
            await recorder.recordFinished(
                tx,
                ctx,
                item,
                done,
                item.proposal,
                {
                    path: "human",
                    by,
                    outcome: "approved",
                },
                RESULT,
            )
        } else {
            await items.markRejected(item.id, item.proposal, { summary: "Owner rejected" }, tx)
            await recorder.recordRejected(tx, ctx, item, item.proposal, by, null)
        }
    })
    return by
}
