import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { QuotaStatus } from "./ai-usage-events.contracts"
import { AiUsageEventsService } from "./ai-usage-events.service"
import { UsageGateService } from "./usage-gate.service"

const statusOf = builder<QuotaStatus>({
    periodStart: "2026-10-01",
    messagesUsed: 100,
    tokensUsed: 1000,
    costUsd: 0.4,
    messagesLimit: 100,
    tokensLimit: 10000,
    fallbackReply: "",
    creditsUsed: 200,
    creditsLimit: 200,
    creditsCarried: 0,
    topupBalance: 0,
    messagesExceeded: true,
    tokensExceeded: false,
    creditsExceeded: true,
    ratio: 1,
    level: "exceeded",
})

const build = async () => {
    const usage = mock<AiUsageEventsService>({ record: jest.fn(() => Promise.resolve()) })
    const catalog = mock<MessageCatalog>({
        get: jest.fn((...[key, , locale]: Parameters<MessageCatalog["get"]>) => `${key}:${locale}`),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            UsageGateService,
            { provide: AiUsageEventsService, useValue: usage },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { gate: moduleRef.get(UsageGateService), usage }
}

describe("UsageGateService", () => {
    describe("blockedBy", () => {
        it("answers the exceeded sentence in the asked language when the allowance is used up", async () => {
            const { gate, usage } = await build()
            usage.blockedBy.mockResolvedValue(statusOf())

            await expect(gate.blockedBy("ws-1", "relay", "en")).resolves.toEqual({ message: "usage.exceeded:en" })

            expect(usage.blockedBy).toHaveBeenCalledWith("ws-1", "relay", false)
        })

        it("answers no block within the allowance, booking an unknown kind as engine work", async () => {
            const { gate, usage } = await build()
            usage.blockedBy.mockResolvedValue(null)

            await expect(gate.blockedBy("ws-1", "mystery", "vi")).resolves.toBeNull()

            expect(usage.blockedBy).toHaveBeenCalledWith("ws-1", "engine", false)
        })
    })

    describe("record", () => {
        it("meters a run with its model, its tokens summed and its cost", async () => {
            const { gate, usage } = await build()

            await gate.record({
                workspaceId: "ws-1",
                kind: "relay",
                module: "office",
                usage: { prompt_tokens: 10, completion_tokens: 5, cached_tokens: 4, cost: 0.1, model: "m" },
                completionChars: 42,
            })

            expect(usage.record.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        kind: "relay",
                        module: "office",
                        model: "m",
                        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.1, cached_tokens: 4 },
                        promptChars: 0,
                        completionChars: 42,
                    },
                ],
            ])
        })

        it("meters a run that reported nothing under the default model with no usage", async () => {
            const { gate, usage } = await build()

            await gate.record({ workspaceId: "ws-1", kind: "brain", module: "brain", usage: null, completionChars: 3 })

            expect(usage.record.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        kind: "brain",
                        module: "brain",
                        model: "openclaw",
                        usage: null,
                        promptChars: 0,
                        completionChars: 3,
                    },
                ],
            ])
        })
    })
})

describe("UsageGateService, a run that reported nothing", () => {
    describe("record", () => {
        it("hands the prompt length on, so a run that reported nothing is still estimated", async () => {
            const { gate, usage } = await build()

            await gate.record({
                workspaceId: "ws-1",
                kind: "agent_work",
                module: "accounting",
                usage: null,
                completionChars: 0,
                promptChars: 900,
            })

            expect(usage.record.mock.calls[0]?.[0]).toMatchObject({ promptChars: 900, completionChars: 0, usage: null })
        })
    })
})

describe("UsageGateService > a generation made for a run", () => {
    it("books the call to the run it was made for", async () => {
        const { gate, usage } = await build()

        await gate.record({
            workspaceId: "ws-1",
            kind: "agent_work",
            module: "sales",
            usage: null,
            completionChars: 3,
            runId: "run-3",
        })

        expect(usage.record.mock.calls[0]?.[0]).toMatchObject({ runId: "run-3" })
    })
})

describe("UsageGateService > what a call was and how it went", () => {
    it("hands the prompt library's call facts on to the booking, and none when the caller told none", async () => {
        const { gate, usage } = await build()
        const call = {
            purpose: "accounting.match-payment:agent",
            reasoningTokens: 2542,
            durationMs: 7414,
            tryNumber: 1,
            upstream: "Parasail",
            finishReason: "stop",
        }
        const run = { prompt_tokens: 8162, completion_tokens: 2636, cached_tokens: 8064, cost: 0.001, model: "m" }

        await gate.record({ workspaceId: "ws-1", kind: "engine", module: "accounting", usage: run, completionChars: 200, call })
        await gate.record({ workspaceId: "ws-1", kind: "engine", module: "accounting", usage: run, completionChars: 200 })

        expect(usage.record.mock.calls[0]?.[0]).toMatchObject({ call })
        expect(usage.record.mock.calls[1]?.[0]).not.toHaveProperty("call")
    })
})
