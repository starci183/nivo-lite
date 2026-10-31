import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { runtimeInstallationOf, runtimeTurn } from "@tests/fixtures/builders/customer-turn-runtime.builder"
import { AgentTurnBriefService, RuntimeAgentService } from "@modules/domain/agent-turns"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CustomerCorePlanService } from "./customer-core-plan.service"
import { CustomerTurnRuntimeService } from "./customer-turn-runtime.service"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import { TurnToolAccessService } from "./turn-tool-access.service"
import type { InstallationOrReason } from "./customer-turns.contracts"

interface Options {
    readonly installation?: InstallationOrReason
    readonly intents?: string
}

const build = async ({ installation = runtimeInstallationOf(), intents = "" }: Options = {}) => {
    const runtime = mock<CustomerTurnRuntimeService>({
        installationOf: jest.fn().mockResolvedValue(installation),
        systemOf: jest.fn().mockResolvedValue({ text: "SYSTEM KNOW", sources: [] }),
    })
    const agents = mock<RuntimeAgentService>({ agentFor: jest.fn().mockResolvedValue("ws-chatbot") })
    const brief = mock<AgentTurnBriefService>({ intentsBlock: jest.fn().mockResolvedValue(intents) })
    const access = mock<TurnToolAccessService>({ keep: jest.fn(), close: jest.fn() })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerCorePlanService,
            { provide: LOGGER, useValue: logger },
            { provide: CustomerTurnRuntimeService, useValue: runtime },
            { provide: RuntimeAgentService, useValue: agents },
            { provide: AgentTurnBriefService, useValue: brief },
            { provide: TurnToolAccessService, useValue: access },
        ],
    }).compile()
    return { plans: moduleRef.get(CustomerCorePlanService), runtime, agents, brief, access, logger }
}

describe("CustomerCorePlanService.planOf", () => {
    it("plans the turn on the module's agent with the context, the graph's intents and the session of the conversation, and no tool block", async () => {
        const { plans, access, agents } = await build({ intents: "INTENTS" })

        const plan = await plans.planOf(runtimeTurn)

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

        await expect(plans.planOf(runtimeTurn)).resolves.toMatchObject({ timeoutMs: 10_000 })
    })

    it("leaves the intents out when the graph cannot be read, and logs it", async () => {
        const { plans, brief, logger } = await build()
        const cause = new Error("graph down")
        brief.intentsBlock.mockRejectedValue(cause)

        const plan = await plans.planOf(runtimeTurn)

        expect(typeof plan === "string" ? plan : plan.message).not.toContain("INTENTS")
        expect(logger.error).toHaveBeenCalledWith(CustomerTurnsLogEvent.ContextPartFailed, cause, {
            workspaceId: runtimeTurn.conversation.workspaceId,
            part: "intents",
        })
    })

    it("answers the reason the installation does not run, and builds nothing", async () => {
        const { plans, agents, runtime } = await build({ installation: "needs_connection" })

        await expect(plans.planOf(runtimeTurn)).resolves.toBe("needs_connection")
        expect(agents.agentFor).not.toHaveBeenCalled()
        expect(runtime.systemOf).not.toHaveBeenCalled()
    })

    it("answers unavailable and logs when the runtime agent cannot be built, keeping no knowledge", async () => {
        const { plans, agents, access, logger } = await build({ installation: null })
        const cause = new Error("sync down")
        agents.agentFor.mockRejectedValue(cause)

        await expect(plans.planOf(runtimeTurn)).resolves.toBe("openclaw_unavailable")
        expect(logger.error).toHaveBeenCalledWith(CustomerTurnsLogEvent.TurnFailed, cause, { conversationId: "c1" })
        expect(access.keep).not.toHaveBeenCalled()
    })
})

describe("CustomerCorePlanService.end", () => {
    it("forgets what the turn kept for its cards", async () => {
        const { plans, access } = await build()

        plans.end(runtimeTurn)

        expect(access.close).toHaveBeenCalledWith(runtimeTurn)
    })
})
