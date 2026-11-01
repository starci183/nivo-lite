import { Injectable } from "@nestjs/common"
import { resolveApprovers } from "@modules/domain/approval-requests"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { ApproverGroup } from "@modules/domain/authority-rules"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import { MemberGrantsService } from "@modules/domain/member-grants"
import type { DirectoryMember, MemberGrant } from "@modules/domain/member-grants"
import { ModulesService } from "@modules/domain/modules"
import type { CeilingRule, GraphContext, GraphDocument } from "./agent-graphs.contracts"
import { GraphFactsService } from "./graph-facts.service"
import { amountFactOf, intervalOf, topOf } from "./policies/interval.policy"

/** Who can answer one ask of the graph, and who was left out. */
export interface AskCoverage {
    /** The node that asks. */
    readonly nodeKey: string
    /** The branch that asks, or null for an approval step. */
    readonly branchKey: string | null
    /** The top of the amounts the branch covers, or null when it has none. */
    readonly top: number | null
    /** The names of the people a request would go to. */
    readonly approvers: ReadonlyArray<string>
    /** The people of the group left out, with the reason. */
    readonly excluded: ReadonlyArray<{ readonly name: string; readonly reason: string }>
    /** False when nobody can approve up to the top of the branch. */
    readonly covered: boolean
}

/** The agent the context is built for. */
export interface ContextScope {
    /** The workspace id. */
    readonly workspaceId: string
    /** The agent id. */
    readonly agentId: string
    /** The installation id. */
    readonly installationId: string
    /** The module key. */
    readonly moduleKey: string
}

@Injectable()
/**
 * What the pure checks of a graph need to know about the workspace, read once per check: the facts the modules declare, the ceiling
 * the authority rules put on each action the graph decides, the tools the agent holds a grant on, and who can approve what (the
 * people of the workspace and their grants, read through the same function that routes a request, so the editor says the same
 * thing the approval will).
 */
export class AgentGraphContextService {
    constructor(
        private readonly facts: GraphFactsService,
        private readonly rules: AuthorityRulesService,
        private readonly gateway: McpGatewayService,
        private readonly members: MemberGrantsService,
        private readonly modules: ModulesService,
    ) {}

    /** The context of one agent for the graph about to be checked. */
    async contextOf(scope: ContextScope, graph: GraphDocument): Promise<GraphContext> {
        const actions = graph.nodes.flatMap((node) => (node.decide === undefined ? [] : [node.decide.intent]))
        const [catalog, grants, directory] = await Promise.all([
            this.modules.find(scope.moduleKey),
            this.gateway.grantsOf(scope.workspaceId, scope.agentId),
            this.members.directory(scope.workspaceId),
        ])
        const grantsByAction = new Map(
            await Promise.all(
                actions.map(async (action): Promise<[string, ReadonlyArray<MemberGrant>]> => [
                    action,
                    await this.members.forAction(scope.workspaceId, action),
                ]),
            ),
        )
        const ceilings = await Promise.all(
            actions.map(async (action): Promise<CeilingRule> => {
                const rule = await this.rules.ruleFor(scope, action, scope.installationId, scope.agentId)
                return {
                    action,
                    mode: rule?.mode ?? "never",
                    limitVnd: rule?.limit_vnd ?? null,
                    autoMax: rule?.auto_max ?? null,
                    maxMode: catalog.authorityActions.find((entry) => entry.action === action)?.maxMode ?? null,
                }
            }),
        )
        const granted = new Set(grants.filter((grant) => grant.mode !== "never").map((grant) => grant.tool))
        return {
            facts: this.facts.registry(),
            ceilings,
            isGranted: (tool) => granted.has(tool) || granted.has(`${tool.split(".", 1).join("")}.*`),
            approverCovers: (action, group, top) =>
                this.approversOf(action, group, top, directory, grantsByAction).approvers.length > 0,
            groupHasPeople: (group) => {
                const set = this.approversOf("", group, null, directory, new Map())
                return set.approvers.length + set.excluded.filter((entry) => entry.reason !== "inactive").length > 0
            },
            facesCustomers: catalog.audience === "customer",
        }
    }

    /** Who can answer each ask of the graph: the people, those left out and why, and whether the amounts at the top of the branch are covered. */
    async coverageOf(scope: ContextScope, graph: GraphDocument): Promise<ReadonlyArray<AskCoverage>> {
        const asks = graph.nodes.flatMap((node) => {
            const { decide } = node
            const own =
                node.approver === null
                    ? []
                    : [
                          {
                              nodeKey: node.key,
                              branchKey: null,
                              action: node.action ?? "",
                              approver: node.approver,
                              when: null,
                              decide: undefined,
                          },
                      ]
            const branches =
                decide === undefined
                    ? []
                    : decide.branches.flatMap((branch) =>
                          branch.approver === null || branch.then !== "ask"
                              ? []
                              : [
                                    {
                                        nodeKey: node.key,
                                        branchKey: branch.key,
                                        action: decide.intent,
                                        approver: branch.approver,
                                        when: branch.when,
                                        decide,
                                    },
                                ],
                      )
            return [...own, ...branches]
        })
        const facts = this.facts.registry()
        const directory = await this.members.directory(scope.workspaceId)
        return Promise.all(
            asks.map(async (ask) => {
                const amountFact = ask.decide === undefined ? null : amountFactOf(ask.decide, facts)
                const interval =
                    amountFact === null || ask.when === null || ask.when === "else"
                        ? null
                        : intervalOf(ask.when, amountFact)
                const top = interval === null ? null : topOf(interval)
                const grants = await this.members.forAction(scope.workspaceId, ask.action)
                const set = resolveApprovers({
                    group: ask.approver.group,
                    directory,
                    grants,
                    need: { unit: "vnd", amount: top },
                })
                return {
                    nodeKey: ask.nodeKey,
                    branchKey: ask.branchKey,
                    top,
                    approvers: set.approvers.map((person) => person.name),
                    excluded: set.excluded.flatMap((entry) =>
                        directory
                            .filter((person) => person.memberId === entry.memberId)
                            .map((person) => ({ name: person.name, reason: entry.reason })),
                    ),
                    covered: set.approvers.length > 0,
                }
            }),
        )
    }

    private approversOf(
        action: string,
        group: ApproverGroup,
        top: number | null,
        directory: ReadonlyArray<DirectoryMember>,
        grantsByAction: ReadonlyMap<string, ReadonlyArray<MemberGrant>>,
    ): ReturnType<typeof resolveApprovers> {
        return resolveApprovers({
            group,
            directory,
            grants: grantsByAction.get(action) ?? [],
            need: { unit: "vnd", amount: top },
        })
    }
}
