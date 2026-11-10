import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AiUsageEventsService, UsageGateService } from "@modules/domain/ai-usage-events"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER, withRunScope, withWorkScope } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { ANSWER, COMBO_ORDER, USAGE } from "@tests/fixtures/builders/ai-tasks-service.builder"
import { AiTasksService } from "./ai-tasks.service"
import { AI_TASKS_METER, AI_TASKS_OPTIONS } from "./ai-tasks.decorators"
import { NodeImagesService } from "./node-images.service"
import { NotesService } from "./notes.service"
import { ORDER_SCHEMA } from "./ai-tasks.schema"

const RUN = "9e0c8d1a-1111-4222-8333-444455556666"
const AGENT = "0b6f6c2e-1111-4222-8333-444455556666"
const SONNET = "claude-sonnet-5-5"

/** The REAL prompt library metered through the REAL usage gate and usage events service; the database answers inserts. */
const build = async () => {
    const ai = mock<AiService>()
    ai.available.mockReturnValue(true)
    const em = mockEntityManager()
    em.insert.mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] })
    em.query.mockResolvedValue([])
    const timer = mock<Timer>({
        schedule: jest.fn((callback: () => void) => {
            callback()
            return () => undefined
        }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AiTasksService,
            AiUsageEventsService,
            UsageGateService,
            { provide: AI_TASKS_METER, useExisting: UsageGateService },
            {
                provide: AI_TASKS_OPTIONS,
                useValue: { timeoutMs: 30_000, providers: { anthropic: true, openrouter: false } },
            },
            { provide: AI, useValue: ai },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: NotesService, useValue: mock<NotesService>() },
            { provide: NodeImagesService, useValue: mock<NodeImagesService>() },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn(() => "x") }) },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: TIMER, useValue: timer },
        ],
    }).compile()
    const rows = (): ReadonlyArray<Record<string, unknown>> =>
        em.insert.mock.calls.map(([, row]) => row as Record<string, unknown>)
    return { client: moduleRef.get(AiTasksService), ai, rows }
}

describe("failed tries are booked (owner 2026-11-11: model and credits on every node)", () => {
    it("3 failed tries + 1 answer = 4 rows, 3 estimated: each on the step, agent and run, priced, the failed ones never billed", async () => {
        const { client, ai, rows } = await build()
        ai.attempt
            .mockResolvedValueOnce({ ok: false, failure: "timeout" })
            .mockResolvedValueOnce({ ok: false, failure: "provider" })
            .mockResolvedValueOnce({ ok: false, failure: "length" })
            .mockResolvedValueOnce({
                ok: true,
                answer: { ...ANSWER, text: JSON.stringify(COMBO_ORDER), model: SONNET, usage: USAGE },
            })
        const scope = {
            workspaceId: "ws-1",
            locale: "vi" as const,
            model: { model: SONNET, weight: "heavy" as const, source: "node" as const },
        }
        const ask = {
            purpose: "accounting.match-payment:agent",
            instructions: "Match the transfer.",
            input: { amount: 3000 },
        }

        await withRunScope(RUN, () =>
            // The scope the graph node host opens for the step `match` of the run (`nodeWorkOf`).
            withWorkScope({ kind: "node", stepKey: "match", agentId: AGENT }, async () => {
                // The step's first call fails all three tries; the engine asks again and the call answers on its first try.
                await expect(client.nodeJson(scope, ask, ORDER_SCHEMA)).rejects.toMatchObject({ params: { tries: 3 } })
                await client.nodeJson(scope, ask, ORDER_SCHEMA)
            }),
        )

        const booked = rows()
        expect(booked).toHaveLength(4)
        expect(booked.map((row) => [row.failure, row.estimated, row.tryNumber])).toEqual([
            ["timeout", true, 1],
            ["provider", true, 2],
            ["length", true, 3],
            [null, false, 1],
        ])
        for (const row of booked) {
            expect(row).toMatchObject({
                runId: RUN,
                workKind: "node",
                stepKey: "match",
                agentId: AGENT,
                model: SONNET,
                declaredModel: SONNET,
                modelProvider: "anthropic",
                purpose: "accounting.match-payment:agent",
            })
        }
        // A failed try carries the prompt the app counted, no output, and the price of that prompt on Sonnet.
        const [failed] = booked
        expect(failed?.completionTokens).toBe(0)
        expect(Number(failed?.promptTokens)).toBeGreaterThan(0)
        expect(Number(failed?.costUsd)).toBeCloseTo((Number(failed?.promptTokens) * 2) / 1_000_000, 8)
        expect(booked[3]).toMatchObject({ promptTokens: 12, completionTokens: 5, costUsd: "0.0002" })
    })
})
