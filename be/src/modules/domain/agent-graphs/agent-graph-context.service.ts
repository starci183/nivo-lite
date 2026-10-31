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
            actions.map(
                async (action): Promise<CeilingRule> => {
                    const rule = await this.rules.ruleFor(scope, action, scope.installationId, scope.agentId)
                    return {
                        action,
                        mode: rule?.mode ?? "never",
                        limitVnd: rule?.limit_vnd ?? null,
                        autoMax: rule?.auto_max ?? null,
                        maxMode: catalog.authorityActions.find((entry) => entry.action === action)?.maxMode ?? null,
                    }
                },
            ),
        )
        const granted = new Set(grants.filter((grant) => grant.mode !== "never").map((grant) => grant.tool))
        return {
            facts: this.facts.registry(),
            ceilings,
            isGranted: (tool) => granted.has(tool) || granted.has(`${tool.split(".")[0] ?? ""}.*`),
            approverCovers: (action, group, top) =>
                this.approversOf(action, group, top, directory, grantsByAction).approvers.length > 0,
            groupHasPeople: (group) => {
                const set = this.approversOf("", group, null, directory, new Map())
                return set.approvers.length + set.excluded.filter((entry) => entry.reason !== "inactive").length > 0
            },
            facesCustomers: catalog.audience === "customer",
        }
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
