import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import { AgentDirectoryService, InjectInstallations } from "@modules/domain/agents"
import type { InstallationDirectory } from "@modules/domain/agents"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeDataPort, NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { cutFields } from "./chat-node-ports.policy"

const KIND = "authority-rule"

@Injectable()
/**
 * The data port of the `authority-rule` kind: the permission level the owner set for one action, as it applies to the agent of the turn
 * (the operating mode of its installation already applied). A graph node reads it to decide whether the agent acts alone or waits for
 * a person. An action the owner set no rule for, or an agent the rule does not cover, answers no row.
 */
export class AuthorityRuleNodePortService implements NodeDataPort, OnModuleInit {
    /** The kind it serves. */
    readonly kind: "authority-rule" = KIND

    constructor(
        @InjectInstallations() private readonly installations: InstallationDirectory,
        private readonly agents: AgentDirectoryService,
        @Optional() private readonly rules?: AuthorityRulesService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the port once the app has started. */
    onModuleInit(): void {
        this.registry?.addDataPort(this)
    }

    /** The rule of the action the query names, cut to the fields asked; no row without an action, a rules service or a rule. */
    async read(turn: NodeTurn, query: NodeQuery): Promise<ReadonlyArray<NodeRow>> {
        const action = query.where?.action
        if (typeof action !== "string" || this.rules === undefined) return []
        const agent = await this.agents.turnFactsOf(turn.agentId)
        if (agent === null) return []
        const installation = await this.installations.ofAgent(turn.workspaceId, turn.agentId)
        const rule = await this.rules.ruleFor(
            { workspaceId: turn.workspaceId },
            action,
            installation?.id ?? null,
            turn.agentId,
        )
        return rule === null ? [] : [cutFields({ id: rule.id, action: rule.action, mode: rule.mode }, query.fields)]
    }
}
