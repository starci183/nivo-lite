import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { runtimeInstallationOf, runtimeTurn } from "@tests/fixtures/builders/customer-turn-runtime.builder"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import {
    AgentTurnBriefService,
    IntentPipelineService,
    IntentTurnService,
    RuntimeAgentService,
} from "@modules/domain/agent-turns"
import type { IntentAttachment, IntentPlan, IntentTurnPlan } from "@modules/domain/agent-turns"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CustomerCorePlanService } from "./customer-core-plan.service"
import { CustomerIntentContextService } from "./customer-intent-context.service"
import { CustomerTurnRuntimeService } from "./customer-turn-runtime.service"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import { turnMessageOf } from "./turn-prompt.policy"
import { TurnToolAccessService } from "./turn-tool-access.service"
import type { InstallationOrReason } from "./customer-turns.contracts"

const wake = agentTurnViewOf({ source: "customer" })

const contractPlan: IntentPlan = {
    versionId: "v-1",
    trigger: "customer_message",
    trust: "outsider",
    pinned: null,
    contracts: [],
}

interface Options {
    readonly installation?: InstallationOrReason
    readonly intents?: string
    readonly contracts?: IntentPlan | null
    readonly files?: ReadonlyArray<IntentAttachment>
}

const build = async ({
    installation = runtimeInstallationOf(),
    intents = "",
    contracts = null,
    files = [],
}: Options = {}) => {
    const runtime = mock<CustomerTurnRuntimeService>({
        installationOf: jest.fn().mockResolvedValue(installation),
        systemOf: jest.fn().mockResolvedValue({ text: "SYSTEM KNOW", sources: [] }),
    })
    const agents = mock<RuntimeAgentService>({ agentFor: jest.fn().mockResolvedValue("ws-chatbot") })
    const brief = mock<AgentTurnBriefService>({ intentsBlock: jest.fn().mockResolvedValue(intents) })
    const access = mock<TurnToolAccessService>({ keep: jest.fn(), close: jest.fn() })
    const logger = mock<Logger>()
    const turnIntents = mock<IntentTurnService>({
        planFor: jest.fn().mockResolvedValue(contracts),
        planOf: jest.fn((plan: IntentPlan): IntentTurnPlan => ({ ...plan, prompt: "CONTRACT PROMPT" })),
    })
    const pipeline = mock<IntentPipelineService>({ open: jest.fn().mockResolvedValue(undefined) })
    const context = mock<CustomerIntentContextService>({
        contextOf: jest
            .fn()
            .mockResolvedValue({ identity: "You are Mai.", input: [], sources: [], attachments: files, money: null }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerCorePlanService,
            { provide: LOGGER, useValue: logger },
            { provide: CustomerTurnRuntimeService, useValue: runtime },
            { provide: RuntimeAgentService, useValue: agents },
            { provide: AgentTurnBriefService, useValue: brief },
            { provide: TurnToolAccessService, useValue: access },
            { provide: IntentTurnService, useValue: turnIntents },
            { provide: IntentPipelineService, useValue: pipeline },
            { provide: CustomerIntentContextService, useValue: context },
        ],
    }).compile()
    return {
        plans: moduleRef.get(CustomerCorePlanService),
        runtime,
        agents,
        brief,
        access,
        logger,
        turnIntents,
        pipeline,
        context,
    }
}

describe("CustomerCorePlanService.planOf", () => {
    it("plans the turn on the module's agent with the context, the graph's intents and the session of the conversation, and no tool block", async () => {
        const { plans, access, agents } = await build({ intents: "INTENTS" })

        const plan = await plans.planOf(runtimeTurn, wake)

        const { message, ...rest } = typeof plan === "string" ? { message: plan } : plan
        expect(rest).toEqual({
            module: "chatbot",
            runtimeAgentId: "ws-chatbot",
            threadKey: "agent:ws-chatbot:c1",
            timeoutMs: 25_000,
        })
        expect(message).toContain("SYSTEM KNOW\n\nINTENTS")
        expect(message).not.toContain("[OPTIONAL TOOLS]")
        expect(access.keep).toHaveBeenCalledWith(runtimeTurn, [])
        expect(agents.agentFor).toHaveBeenCalledWith(runtimeTurn.conversation.workspaceId, "chatbot", expect.anything())
    })

    it("uses the reply time of the installation", async () => {
        const { plans } = await build({ installation: runtimeInstallationOf({ openclawTimeoutSec: 10 }) })

        await expect(plans.planOf(runtimeTurn, wake)).resolves.toMatchObject({ timeoutMs: 10_000 })
    })

    it("waits the default time for an agent that has no installation", async () => {
        const { plans } = await build({ installation: null })

        await expect(plans.planOf(runtimeTurn, wake)).resolves.toMatchObject({ timeoutMs: 25_000 })
    })

    it("leaves the intents out when the graph cannot be read, and logs it", async () => {
        const { plans, brief, logger } = await build()
        const cause = new Error("graph down")
        brief.intentsBlock.mockRejectedValue(cause)

        const plan = await plans.planOf(runtimeTurn, wake)

        expect(typeof plan === "string" ? plan : plan.message).not.toContain("INTENTS")
        expect(logger.error).toHaveBeenCalledWith(CustomerTurnsLogEvent.ContextPartFailed, cause, {
            workspaceId: runtimeTurn.conversation.workspaceId,
            part: "intents",
        })
    })

    it("answers the reason the installation does not run, and builds nothing", async () => {
        const { plans, agents, runtime } = await build({ installation: "needs_connection" })

        await expect(plans.planOf(runtimeTurn, wake)).resolves.toBe("needs_connection")
        expect(agents.agentFor).not.toHaveBeenCalled()
        expect(runtime.systemOf).not.toHaveBeenCalled()
    })

    it("answers unavailable and logs when the runtime agent cannot be built, keeping no knowledge", async () => {
        const { plans, agents, access, logger } = await build({ installation: null })
        const cause = new Error("sync down")
        agents.agentFor.mockRejectedValue(cause)

        await expect(plans.planOf(runtimeTurn, wake)).resolves.toBe("openclaw_unavailable")
        expect(logger.error).toHaveBeenCalledWith(CustomerTurnsLogEvent.TurnFailed, cause, { conversationId: "c1" })
        expect(access.keep).not.toHaveBeenCalled()
    })
})

describe("CustomerCorePlanService.planOf > the contract pipeline", () => {
    it("builds the very message it always did when the graph holds no contracts for a customer's message", async () => {
        const { plans, turnIntents, pipeline, context } = await build({ intents: "INTENTS", contracts: null })

        const plan = await plans.planOf(runtimeTurn, wake)

        expect(plan).toMatchObject({
            message: turnMessageOf("SYSTEM KNOW\n\nINTENTS", runtimeTurn.transcript, runtimeTurn.body),
        })
        expect(turnIntents.planFor).toHaveBeenCalledWith({
            workspaceId: runtimeTurn.conversation.workspaceId,
            agentId: runtimeTurn.conversation.agent.id,
            source: "customer",
            authorUserId: null,
            pinned: null,
        })
        expect(context.contextOf).not.toHaveBeenCalled()
        expect(pipeline.open).not.toHaveBeenCalled()
    })

    it("plans the turn with the five-part contract prompt, keeps the knowledge for its cards and opens its run", async () => {
        const { plans, turnIntents, pipeline, access } = await build({ contracts: contractPlan })

        const plan = await plans.planOf(runtimeTurn, wake)

        expect(plan).toEqual({
            module: "chatbot",
            runtimeAgentId: "ws-chatbot",
            threadKey: "agent:ws-chatbot:c1",
            message: "CONTRACT PROMPT",
            timeoutMs: 25_000,
        })
        expect(turnIntents.planOf).toHaveBeenCalledWith(contractPlan, "You are Mai.", [], "vi")
        expect(access.keep).toHaveBeenCalledWith(runtimeTurn, [])
        expect(pipeline.open).toHaveBeenCalledWith(wake, expect.objectContaining({ prompt: "CONTRACT PROMPT" }))
    })

    it("sends the image of a customer message with the plan, as the attachments of the turn", async () => {
        const files = [{ fileName: "bill.png", mimeType: "image/png", content: "AAAA" }]
        const { plans } = await build({ contracts: contractPlan, files })

        await expect(plans.planOf(runtimeTurn, wake)).resolves.toMatchObject({ attachments: files })
    })

    it("pins the scope to the intent of a follow-up wake", async () => {
        const { plans, turnIntents } = await build({ contracts: contractPlan })

        await plans.planOf(runtimeTurn, agentTurnViewOf({ source: "customer", context: { intent: "confirm_order" } }))

        expect(turnIntents.planFor).toHaveBeenCalledWith(expect.objectContaining({ pinned: "confirm_order" }))
    })
})

describe("CustomerCorePlanService.end", () => {
    it("forgets what the turn kept for its cards", async () => {
        const { plans, access } = await build()

        plans.end(runtimeTurn)

        expect(access.close).toHaveBeenCalledWith(runtimeTurn)
    })
})
