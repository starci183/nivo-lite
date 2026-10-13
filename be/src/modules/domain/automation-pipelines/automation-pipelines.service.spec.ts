import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { TemplateDefinition } from "@modules/domain/automation-templates"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AutomationPipelinesService } from "./automation-pipelines.service"
import type { PipelineRow, PipelineWrite } from "./automation-pipelines.contracts"
import { AutomationPipelinesErrorCode } from "./errors/automation-pipelines.error"
import {
    SELECT_ENABLED_PIPELINES,
    SELECT_PIPELINE,
    SELECT_PIPELINE_BY_ID,
    SELECT_PIPELINE_KEYS,
    UPDATE_PIPELINE_LADDER,
    UPSERT_PIPELINE,
} from "./persistence/automation-pipelines.sql"

const ROW: PipelineRow = {
    id: "p-1",
    workspace_id: "ws-1",
    template_key: "thank_payment",
    name: "Thank",
    module_key: "sales",
    enabled: true,
    dismissed: false,
    config: {},
    body: null,
    body_version: 0,
    template_version: 1,
    based_on_context: null,
    approval_streak: 0,
    trust_offered_at: null,
    auto_send: false,
    created_at: "2026-10-12T00:00:00.000Z",
    updated_at: "2026-10-12T00:00:00.000Z",
}

const WRITE: PipelineWrite = {
    enabled: true,
    dismissed: false,
    config: { hour: 9 },
    body: "Hello",
    bodyVersion: 2,
    basedOnContext: 3,
    approvalStreak: 4,
    trustOfferedAt: null,
    autoSend: false,
}

const TEXT = { vi: "Xin chao", en: "Hello" }

const template = (overrides: Partial<TemplateDefinition>): TemplateDefinition => ({
    key: "thank_payment",
    version: 1,
    position: 1,
    pack: "core",
    executor: "implemented",
    moduleKey: "sales",
    icon: "payment",
    name: TEXT,
    description: TEXT,
    trigger: { kind: "event", event: "payment.received", line: TEXT },
    requires: { modules: [], channels: [], connections: [], capabilities: [] },
    settings: [],
    contentMode: "none",
    guardrails: [],
    variables: [],
    defaultBody: null,
    authority: { action: null },
    defaults: {},
    ...overrides,
})

const DEFINITION = template({ name: { vi: "Cam on", en: "Thank" }, version: 5 })

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AutomationPipelinesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(AutomationPipelinesService)
}

describe("AutomationPipelinesService", () => {
    describe("findPipeline", () => {
        it("answers the pipeline of a template in a workspace", async () => {
            const em = mockEntityManager({ query: [SELECT_PIPELINE, [ROW]] })

            await expect((await build(em)).findPipeline("ws-1", "thank_payment")).resolves.toEqual(ROW)

            expect(em.query).toHaveBeenCalledWith(SELECT_PIPELINE, ["ws-1", "thank_payment"])
        })

        it("answers none before the first switch", async () => {
            const em = mockEntityManager({ query: [SELECT_PIPELINE, []] })

            await expect((await build(em)).findPipeline("ws-1", "thank_payment")).resolves.toBeNull()
        })
    })

    describe("findPipelineById", () => {
        it("answers the pipeline, or none", async () => {
            const em = mockEntityManager({ query: [[SELECT_PIPELINE_BY_ID, [ROW]]] })
            const service = await build(em)

            await expect(service.findPipelineById("p-1")).resolves.toEqual(ROW)

            const empty = await build(mockEntityManager({ query: [SELECT_PIPELINE_BY_ID, []] }))
            await expect(empty.findPipelineById("p-2")).resolves.toBeNull()
        })
    })

    describe("enabledPipelines", () => {
        it("reads the pipelines of every workspace and of one workspace", async () => {
            const em = mockEntityManager({ query: [SELECT_ENABLED_PIPELINES, [ROW]] })
            const service = await build(em)

            await expect(service.enabledPipelines()).resolves.toEqual([ROW])
            await expect(service.enabledPipelinesOf("ws-1")).resolves.toEqual([ROW])

            expect(em.query).toHaveBeenNthCalledWith(1, SELECT_ENABLED_PIPELINES, [null])
            expect(em.query).toHaveBeenNthCalledWith(2, SELECT_ENABLED_PIPELINES, ["ws-1"])
        })
    })

    describe("pipelineKeys", () => {
        it("reads the id and template key of each pipeline of a workspace", async () => {
            const em = mockEntityManager({ query: [SELECT_PIPELINE_KEYS, [{ id: "p-1", template_key: "a" }]] })

            await expect((await build(em)).pipelineKeys("ws-1")).resolves.toEqual([{ id: "p-1", template_key: "a" }])
        })
    })

    describe("savePipeline", () => {
        it("writes the template and the columns and answers the stored row", async () => {
            const em = mockEntityManager({ query: [UPSERT_PIPELINE, [ROW]] })

            await expect((await build(em)).savePipeline("ws-1", "user-1", DEFINITION, WRITE)).resolves.toEqual(ROW)

            expect(em.query).toHaveBeenCalledWith(UPSERT_PIPELINE, [
                "ws-1",
                "thank_payment",
                "Cam on",
                "sales",
                5,
                "user-1",
                true,
                false,
                '{"hour":9}',
                "Hello",
                2,
                3,
                4,
                null,
                false,
            ])
        })

        it("fails when the database stores nothing", async () => {
            const em = mockEntityManager({ query: [UPSERT_PIPELINE, []] })

            await expect((await build(em)).savePipeline("ws-1", "user-1", DEFINITION, WRITE)).rejects.toMatchObject({
                code: AutomationPipelinesErrorCode.NotSaved,
            })
        })
    })

    describe("saveLadder", () => {
        it("records the streak and the offer", async () => {
            const em = mockEntityManager({ query: [UPDATE_PIPELINE_LADDER, [{ id: "p-1" }]] })

            await expect((await build(em)).saveLadder("p-1", 3, "2026-10-12T00:00:00.000Z")).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(UPDATE_PIPELINE_LADDER, ["p-1", 3, "2026-10-12T00:00:00.000Z"])
        })
    })
})
