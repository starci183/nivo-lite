import { Injectable } from "@nestjs/common"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { ApprovalSetup } from "@modules/domain/authority-rules"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModulesService } from "@modules/domain/modules"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState, OptionalGraphState } from "./agent-graphs.service"
import type { SeedAction, SeedRule } from "./agent-graphs-seed.contracts"
import type { GraphDocument } from "./agent-graphs.contracts"
import { graphDocumentSchema } from "./agent-graphs.schema"
import { baseGraphOf } from "./policies/base-graph.policy"
import { sameBehaviour } from "./policies/graph-behaviour.policy"

/** The wait given to a rule the owner never set approvers on, minutes. */
const DEFAULT_TIMEOUT_MINUTES = 240

/** A rule the owner granted none for: nothing may run, and nobody is named. */
const closedRule = (action: string): SeedRule => ({
    action,
    mode: "never",
    unit: "vnd",
    limit_vnd: null,
    auto_max: null,
    ask_max: null,
    approver_roles: [],
    approver_rooms: [],
    approver_members: [],
    approval_policy: "any",
    timeout_minutes: DEFAULT_TIMEOUT_MINUTES,
})

const ruleOf = (action: string, setup: ApprovalSetup | null, limitVnd: number | null): SeedRule =>
    setup === null
        ? closedRule(action)
        : {
              action,
              mode: setup.mode,
              unit: setup.unit,
              limit_vnd: limitVnd,
              auto_max: setup.auto_max,
              ask_max: setup.ask_max,
              approver_roles: setup.group.roles,
              approver_rooms: setup.group.rooms,
              approver_members: setup.group.members,
              approval_policy: setup.policy,
              timeout_minutes: setup.timeout_minutes,
          }

@Injectable()
/**
 * Gives an agent the graph it already has in effect: its module's base graph from the catalogue and the templates, with the rule the
 * owner set for each action turned into branches, so a seeded graph answers what the gate answers. It is code and not SQL because it
 * needs the catalogue. A seed is enforced, and it follows the rule it came from until a person publishes a version of their own.
 */
export class AgentGraphSeedService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly graphs: AgentGraphsService,
        private readonly installations: InstallationRecordsService,
        private readonly modules: ModulesService,
        private readonly templates: AutomationTemplatesService,
        private readonly rules: AuthorityRulesService,
    ) {}

    /** The graph of the installation's agent, seeded on the first call; null when the installation has no agent yet. */
    async ensureFor(installationId: string, locale: Locale): Promise<OptionalGraphState> {
        const installation = await this.installations.findById(installationId)
        const agentId = installation?.agentId ?? null
        if (installation === null || agentId === null) return null
        const { workspaceId, moduleKey } = installation
        const existing = await this.graphs.stateOfAgent(workspaceId, agentId)
        if (existing !== null) return existing
        return this.graphs.ensure(
            workspaceId,
            agentId,
            installationId,
            await this.derive(workspaceId, moduleKey, installationId, agentId, locale),
        )
    }

    /**
     * Brings a seed up to the rule it came from: when the rules now derive a graph that does something else, it is published as a new
     * seed. A version a person published never moves this way, and neither does a graph with unpublished edits. Answers whether it moved.
     */
    async refresh(state: GraphState, moduleKey: string, locale: Locale): Promise<boolean> {
        const { workspaceId, agentId, installationId, active } = state
        if (state.activeKind !== "seed" || active === null || !sameBehaviour(state.draft, active)) return false
        const parsed = graphDocumentSchema.safeParse(
            await this.derive(workspaceId, moduleKey, installationId, agentId, locale),
        )
        if (!parsed.success || sameBehaviour(parsed.data, active)) return false
        await this.graphs.publish({
            workspaceId,
            agentId,
            document: parsed.data,
            kind: "seed",
            note: "",
            memberId: null,
            contextVersionId: null,
        })
        return true
    }

    private async derive(
        workspaceId: string,
        moduleKey: string,
        installationId: string,
        agentId: string,
        locale: Locale,
    ): Promise<GraphDocument> {
        const module = await this.modules.find(moduleKey)
        const templates = (await this.templates.listTemplates()).filter((template) => template.moduleKey === moduleKey)
        const rules = await Promise.all(
            module.authorityActions.map((action) => this.seedRuleOf(workspaceId, installationId, agentId, action)),
        )
        return baseGraphOf(module, templates, rules, {
            locale,
            say: (key, params) => this.catalog.get(key, params ?? {}, locale),
        })
    }

    private async seedRuleOf(
        workspaceId: string,
        installationId: string,
        agentId: string,
        action: SeedAction,
    ): Promise<SeedRule> {
        const setup = await this.rules.approvalSetup(workspaceId, action.action)
        const effective = await this.rules.ruleFor({ workspaceId }, action.action, installationId, agentId)
        return ruleOf(action.action, setup, effective?.limit_vnd ?? null)
    }
}
