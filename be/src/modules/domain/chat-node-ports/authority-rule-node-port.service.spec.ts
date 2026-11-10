import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AGENTS_INSTALLATIONS, AgentDirectoryService } from "@modules/domain/agents"
import type { InstallationDirectory } from "@modules/domain/agents"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { AuthorityRule } from "@modules/domain/authority-rules"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { AuthorityRuleNodePortService } from "./authority-rule-node-port.service"

const TURN: NodeTurn = {
    turnId: "t",
    workspaceId: "ws-1",
    agentId: "a-1",
    subject: null,
    conversationId: "c1",
    locale: "vi",
}

const RULE: AuthorityRule = {
    id: "r1",
    department: "chatbot",
    action: "reply_customer",
    mode: "ask",
    limit_vnd: null,
    required_fields: [],
}

/** The agent that speaks in the turn conversation. */
const AGENT = {
    id: "agent-1",
    name: "Chatbot",
    handle: "chatbot",
    role: "Customer chat",
    module: "chatbot",
    instructions: "Be kind",
    knowledge: "Tea",
    approvalRule: "ask",
    greeting: "Hi",
}

const FIELDS = ["id", "action", "mode"]

const build = async (withRules = true) => {
    const registry = mock<GraphNodeRegistryService>()
    const installations = mock<InstallationDirectory>()
    installations.ofAgent.mockResolvedValue(null)
    const agents = mock<AgentDirectoryService>()
    const rules = mock<AuthorityRulesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuthorityRuleNodePortService,
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: AgentDirectoryService, useValue: agents },
            ...(withRules ? [{ provide: AuthorityRulesService, useValue: rules }] : []),
        ],
    }).compile()
    return { port: moduleRef.get(AuthorityRuleNodePortService), registry, agents, rules }
}

describe("AuthorityRuleNodePortService", () => {
    it("registers itself with the graph node registry once the app has started", async () => {
        const { port, registry } = await build()

        port.onModuleInit()

        expect(registry.addDataPort).toHaveBeenCalledWith(port)
    })

    it("answers the rule of the action for the agent of the turn", async () => {
        const { port, agents, rules } = await build()
        agents.turnFactsOf.mockResolvedValue(AGENT)
        rules.ruleFor.mockResolvedValue(RULE)

        await expect(port.read(TURN, { where: { action: "reply_customer" }, fields: FIELDS })).resolves.toEqual([
            { id: "r1", action: "reply_customer", mode: "ask" },
        ])
        expect(rules.ruleFor).toHaveBeenCalledWith({ workspaceId: "ws-1" }, "reply_customer", null, "a-1")
    })

    it("answers no row when the owner set no rule, the agent is gone, no action is named or rules are not installed", async () => {
        const { port, agents, rules } = await build()
        agents.turnFactsOf.mockResolvedValue(AGENT)
        rules.ruleFor.mockResolvedValue(null)
        await expect(port.read(TURN, { where: { action: "reply_customer" }, fields: FIELDS })).resolves.toEqual([])

        agents.turnFactsOf.mockResolvedValue(null)
        await expect(port.read(TURN, { where: { action: "reply_customer" }, fields: FIELDS })).resolves.toEqual([])
        await expect(port.read(TURN, { fields: FIELDS })).resolves.toEqual([])

        const bare = await build(false)
        await expect(bare.port.read(TURN, { where: { action: "reply_customer" }, fields: FIELDS })).resolves.toEqual([])
    })
})
