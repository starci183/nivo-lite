import { readFileSync } from "node:fs"
import { join } from "node:path"
import { DataSource } from "typeorm"
import type { EntityManager } from "typeorm"
import { AiWorkUsageService } from "./ai-work-usage.service"
import { AiUsageEventEntity } from "./persistence/entities"

/** The migration that declares the work columns and the indexes the reads go by. */
const MIGRATION = readFileSync(
    join(__dirname, "../../../../../db/migrations/20261112014000_ai-usage-work-reference.sql"),
    "utf8",
)

/**
 * A REAL TypeORM manager over the real entity (postgres driver, never connected): the reads build their real SQL, which the spec reads
 * back; `getRawMany` answers the rows given instead of a database.
 */
const build = async (rows: ReadonlyArray<object> = []) => {
    const source = new DataSource({ type: "postgres", entities: [AiUsageEventEntity] })
    await (source as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas()
    const sent: Array<{ sql: string; parameters: Record<string, unknown> }> = []
    const manager: EntityManager = source.manager
    const original = manager.createQueryBuilder.bind(manager)
    Object.assign(manager, {
        createQueryBuilder: (...args: Parameters<EntityManager["createQueryBuilder"]>) => {
            const builder = original(...args)
            Object.assign(builder, {
                getRawMany: () => {
                    sent.push({ sql: builder.getQuery(), parameters: builder.getParameters() })
                    return Promise.resolve(rows)
                },
            })
            return builder
        },
    })
    return { service: new AiWorkUsageService(manager), sent }
}

/** The SQL on one line, for reading. */
const flat = (sql: string | undefined): string => (sql ?? "").replace(/\s+/g, " ")

describe("AiWorkUsageService", () => {
    it("graph: one grouped read for the whole graph, by workspace + agent + time (index ai_usage_events_agent_time)", async () => {
        const { service, sent } = await build([
            {
                step_key: "match",
                runs: 4,
                calls: 5,
                failed_tries: 1,
                cost_usd: 0.0226,
                failed_cost_usd: 0.004,
                average_ms: 7_400.4,
                models: ["claude-sonnet-5-5", null],
            },
        ])
        const since = new Date("2026-11-04T00:00:00.000Z")

        await expect(service.agentSteps("ws-1", "agent-1", since)).resolves.toEqual([
            {
                stepKey: "match",
                runs: 4,
                calls: 5,
                failedTries: 1,
                costUsd: 0.0226,
                failedCostUsd: 0.004,
                credits: 20,
                creditsPerRun: 5,
                averageMs: 7_400,
                models: ["claude-sonnet-5-5"],
            },
        ])
        expect(sent).toHaveLength(1)
        const sql = flat(sent[0]?.sql)
        expect(sql).toContain(
            `WHERE "u"."workspace_id" = :workspaceId AND "u"."agent_id" = :agentId AND "u"."created_at" >= :since`,
        )
        expect(sql).toContain(`GROUP BY "u"."step_key"`)
        expect(sql).toContain(`COUNT(DISTINCT "u"."run_id")`)
        expect(sent[0]?.parameters).toEqual({ workspaceId: "ws-1", agentId: "agent-1", since })
        expect(MIGRATION).toContain(
            "CREATE INDEX ai_usage_events_agent_time ON public.ai_usage_events USING btree (workspace_id, agent_id, created_at DESC) WHERE agent_id IS NOT NULL",
        )
    })

    it("documents and lessons: the records given in one grouped read by workspace + record (index ai_usage_events_work_ref)", async () => {
        const { service, sent } = await build([
            {
                work_ref: "source:s1",
                work_kind: "document_critique",
                calls: 1,
                failed_tries: 0,
                tokens: 9_000,
                cost_usd: 0.0113,
                failed_cost_usd: 0,
                models: ["claude-sonnet-5-5"],
            },
            {
                work_ref: "source:s1",
                work_kind: "document_read",
                calls: 3,
                failed_tries: 1,
                tokens: 12_000,
                cost_usd: 0.00226,
                failed_cost_usd: 0.0002,
                models: ["claude-haiku-5-5", "embed"],
            },
        ])

        const usage = await service.byRefs("ws-1", ["source:s1", "source:s2", "source:s1"])

        expect(usage.get("source:s1")?.map((row) => [row.workKind, row.calls, row.credits])).toEqual([
            ["document_critique", 1, 10],
            ["document_read", 3, 2],
        ])
        expect(usage.has("source:s2")).toBe(false)
        const sql = flat(sent[0]?.sql)
        expect(sql).toContain(`WHERE "u"."workspace_id" = :workspaceId AND "u"."work_ref" IN (:...refs)`)
        expect(sent[0]?.parameters).toEqual({ workspaceId: "ws-1", refs: ["source:s1", "source:s2"] })
        expect(MIGRATION).toContain(
            "CREATE INDEX ai_usage_events_work_ref ON public.ai_usage_events USING btree (workspace_id, work_ref) WHERE work_ref IS NOT NULL",
        )
    })

    it("reads nothing for no record", async () => {
        const { service, sent } = await build()

        await expect(service.byRefs("ws-1", [])).resolves.toEqual(new Map())
        expect(sent).toEqual([])
    })

    it("summary: per day, module and kind of work over the window (at most 90 days), the guide left out (index ai_usage_events_ws_time)", async () => {
        const { service, sent } = await build([
            {
                day: "2026-11-11",
                module: "accounting",
                work_kind: "node",
                calls: 6,
                failed_tries: 2,
                tokens: 50_000,
                cost_usd: 0.0565,
                failed_cost_usd: 0.01,
            },
            {
                day: "2026-11-11",
                module: "knowledge",
                work_kind: "document_read",
                calls: 4,
                failed_tries: 0,
                tokens: 8_000,
                cost_usd: 0.000565,
                failed_cost_usd: 0,
            },
        ])

        const days = await service.daily("ws-1", 400)

        expect(days.map((day) => [day.module, day.workKind, day.credits, day.failedTries])).toEqual([
            ["accounting", "node", 50, 2],
            ["knowledge", "document_read", 0.5, 0],
        ])
        const sql = flat(sent[0]?.sql)
        expect(sql).toContain(`WHERE "u"."workspace_id" = :workspaceId AND "u"."kind" <> 'guide'`)
        expect(sql).toContain(`COALESCE("u"."work_kind", "u"."kind")`)
        expect(sent[0]?.parameters).toMatchObject({ days: 90 })
    })

    it("never sums a failed try as an answer: every figure of an answer is filtered on `failure IS NULL`", async () => {
        const { service, sent } = await build()

        await service.agentSteps("ws-1", "agent-1", new Date(0))
        await service.byRefs("ws-1", ["lesson:c1"])
        await service.daily("ws-1", 30)

        for (const { sql } of sent) {
            expect(flat(sql)).toContain(`SUM("u"."cost_usd") FILTER (WHERE "u"."failure" IS NULL)`)
            expect(flat(sql)).toContain(`FILTER (WHERE "u"."failure" IS NOT NULL)`)
        }
    })
})
