import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { RuntimeAgentService } from "@modules/domain/agent-turns"
import { UsageGateService } from "@modules/domain/ai-usage-events"
import type { AuthorityOutputStep } from "@modules/domain/authority-rules"
import type { CustomerTurn } from "@modules/domain/conversations"
import { OPENCLAW_GATEWAY } from "@modules/integrations/openclaw"
import type { GatewayClient } from "@modules/integrations/openclaw"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CustomerTurnRuntimeService } from "./customer-turn-runtime.service"
import { FinalReplyService } from "./final-reply.service"

const TURN = mock<CustomerTurn>()
Object.assign(TURN, {
    messageId: "m1",
    transcript: [],
    conversation: {
        id: "c1",
        workspaceId: "ws",
        speaksAs: null,
        agent: {
            id: "a1",
            module: "chatbot",
            name: "Lan",
            handle: "lan",
            role: "",
            instructions: "",
            knowledge: "",
            approvalRule: "",
        },
    },
})
const OK: AuthorityOutputStep = { tool: "b.create", status: "ok", code: null, summary: '{"id":"B-1"}' }
const FAILED: AuthorityOutputStep = { tool: "b.create", status: "failed", code: "tool_error", summary: "full" }
const containing = (text: string): unknown => expect.stringContaining(text)

const build = async (enabled = true) => {
    const gateway = mock<GatewayClient>({ enabled })
    gateway.runTurn.mockResolvedValue({ text: "Booked B-1.", usage: null, timings: {} })
    const usage = mock<UsageGateService>()
    usage.blockedBy.mockResolvedValue(null)
    usage.record.mockResolvedValue(undefined)
    const runtime = mock<RuntimeAgentService>()
    runtime.agentFor.mockResolvedValue("rt")
    const logger = mock<Logger>()
    const turns = mock<CustomerTurnRuntimeService>()
    turns.installationOf.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            FinalReplyService,
            { provide: OPENCLAW_GATEWAY, useValue: gateway },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: (key: string) => key }) },
            { provide: LOGGER, useValue: logger },
            { provide: RuntimeAgentService, useValue: runtime },
            { provide: CustomerTurnRuntimeService, useValue: turns },
            { provide: UsageGateService, useValue: usage },
        ],
    }).compile()
    return { service: moduleRef.get(FinalReplyService), runTurn: gateway.runTurn, usage, turns, logger }
}

describe("FinalReplyService", () => {
    it("writes the reply from the real result in a session of its own", async () => {
        const { service, runTurn } = await build()
        await expect(service.write(TURN, [OK], "w1", "Will book")).resolves.toBe("Booked B-1.")
        expect(runTurn).toHaveBeenCalledWith(
            expect.objectContaining({
                threadKey: containing("final-w1"),
                idempotencyKey: "final-w1",
                message: containing('{"id":"B-1"}'),
            }),
            expect.any(AbortSignal),
        )
    })

    it("says a failed action failed with no model turn", async () => {
        const { service, runTurn } = await build()
        await expect(service.write(TURN, [FAILED], "w1", "All done")).resolves.toBe("customerTurns.finalReply.failed")
        expect(runTurn).not.toHaveBeenCalled()
    })

    it("keeps a failed operation when a later call of the same tool succeeds", async () => {
        const { service, runTurn } = await build()
        await expect(service.write(TURN, [FAILED, OK], "w1", "All done")).resolves.toBe(
            "customerTurns.finalReply.failed",
        )
        expect(runTurn).not.toHaveBeenCalled()
    })

    it("writes from every successful operation even when their tool is the same", async () => {
        const { service, runTurn } = await build()
        await service.write(TURN, [OK, { ...OK, summary: '{"id":"B-2"}' }], "w1", "Booked both")
        expect(runTurn).toHaveBeenCalledWith(
            expect.objectContaining({
                message: containing('{"id":"B-1"}\nb.create: {"id":"B-2"}'),
            }),
            expect.any(AbortSignal),
        )
    })

    it("gives the honest fixed line when the model turn fails", async () => {
        const { service, runTurn } = await build()
        runTurn.mockRejectedValueOnce(new Error("down"))
        await expect(service.write(TURN, [OK], "w1", "x")).resolves.toBe("customerTurns.finalReply.done")
    })
})

describe("FinalReplyService fixed replies and refusal boundaries", () => {
    it("answers a declined output with the neutral line", async () => {
        const { service, runTurn } = await build()
        expect(service.declined()).toBe("customerTurns.finalReply.declined")
        expect(runTurn).not.toHaveBeenCalled()
    })

    it("uses the fixed completion line when the gateway is disabled without reading allowance", async () => {
        const { service, runTurn, usage } = await build(false)
        await expect(service.write(TURN, [OK], "w1", "x")).resolves.toBe("customerTurns.finalReply.done")
        expect(usage.blockedBy).not.toHaveBeenCalled()
        expect(runTurn).not.toHaveBeenCalled()
    })

    it("uses the fixed completion line when allowance is blocked without reading an installation", async () => {
        const { service, runTurn, usage, turns } = await build()
        usage.blockedBy.mockResolvedValue({ message: "Allowance exhausted" })
        await expect(service.write(TURN, [OK], "w1", "x")).resolves.toBe("customerTurns.finalReply.done")
        expect(turns.installationOf).not.toHaveBeenCalled()
        expect(runTurn).not.toHaveBeenCalled()
    })

    it("uses the fixed completion line for a stopped installation without starting a gateway turn", async () => {
        const { service, runTurn, turns } = await build()
        turns.installationOf.mockResolvedValue("installation_not_running")
        await expect(service.write(TURN, [OK], "w1", "x")).resolves.toBe("customerTurns.finalReply.done")
        expect(runTurn).not.toHaveBeenCalled()
    })
})
