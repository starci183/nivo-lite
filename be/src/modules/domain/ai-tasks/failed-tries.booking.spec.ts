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
import { ANSWER, COMBO_ORDER, ITEMS_SCHEMA, USAGE } from "@tests/fixtures/builders/ai-tasks-service.builder"
import { AiTasksService } from "./ai-tasks.service"
import { AI_TASKS_METER, AI_TASKS_OPTIONS } from "./ai-tasks.decorators"
import { NodeImagesService } from "./node-images.service"
import { NotesService } from "./notes.service"

/** A booked row: what the insert was handed is an object of columns. */
const isRow = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

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
        em.insert.mock.calls.map(([, row]) => row).filter(isRow)
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
                await expect(client.nodeJson(scope, ask, ITEMS_SCHEMA)).rejects.toMatchObject({ params: { tries: 3 } })
                await client.nodeJson(scope, ask, ITEMS_SCHEMA)
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

describe("FX5: a try cut at the output cap books what the provider produced", () => {
    const scope = {
        workspaceId: "ws-1",
        locale: "vi" as const,
        model: { model: SONNET, weight: "heavy" as const, source: "node" as const },
    }
    const ask = { purpose: "sales.consult:agent", instructions: "Consult.", input: { line: "mua" } }
    const answered = {
        ok: true as const,
        answer: { ...ANSWER, text: JSON.stringify(COMBO_ORDER), model: SONNET, usage: USAGE },
    }
    const served = { upstream: "anthropic", finishReason: "length", durationMs: 72_000 }

    it("reported usage: the output tokens, reasoning and time of the cut try, not estimated, never billed", async () => {
        const { client, ai, rows } = await build()
        ai.attempt
            .mockResolvedValueOnce({
                ok: false,
                failure: "length",
                spent: {
                    model: SONNET,
                    usage: {
                        promptTokens: 9000,
                        completionTokens: 7000,
                        totalTokens: 16_000,
                        costUsd: null,
                        reasoningTokens: 120,
                        cachedTokens: 8000,
                    },
                    served,
                    cap: 7000,
                },
            })
            .mockResolvedValueOnce(answered)

        await withRunScope(RUN, () => client.nodeJson(scope, ask, ITEMS_SCHEMA))

        const [cut] = rows()
        expect(cut).toMatchObject({
            failure: "length",
            estimated: false,
            promptTokens: 9000,
            completionTokens: 7000,
            cachedTokens: 8000,
            reasoningTokens: 120,
            durationMs: 72_000,
            finishReason: "length",
            tryNumber: 1,
            model: SONNET,
        })
        // Priced at Sonnet's table line: 1000 fresh + 8000 cached prompt tokens and the 7000 output tokens it produced.
        expect(Number(cut?.costUsd)).toBeCloseTo((1000 * 2 + 8000 * 0.1 + 7000 * 10) / 1_000_000, 6)
    })

    it("no output reported: the output is estimated as the cap and the row stays estimated, with the try's time", async () => {
        const { client, ai, rows } = await build()
        ai.attempt
            .mockResolvedValueOnce({
                ok: false,
                failure: "length",
                spent: {
                    model: SONNET,
                    usage: { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null },
                    served,
                    cap: 7000,
                },
            })
            .mockResolvedValueOnce(answered)

        await withRunScope(RUN, () => client.nodeJson(scope, ask, ITEMS_SCHEMA))

        const [cut] = rows()
        expect(cut).toMatchObject({ failure: "length", estimated: true, completionTokens: 7000, durationMs: 72_000 })
        expect(Number(cut?.promptTokens)).toBeGreaterThan(0)
    })
})
