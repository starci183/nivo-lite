import { Test } from "@nestjs/testing"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { TemplateDefinition } from "@modules/domain/automation-templates"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AutomationPipelinesService } from "./automation-pipelines.service"
import type { PipelineRow, PipelineWrite } from "./automation-pipelines.contracts"
import { AutomationPipelinesErrorCode } from "./errors/automation-pipelines.error"
import { AutomationPipelineEntity } from "./persistence/entities"

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

const ENTITY = Object.assign(new AutomationPipelineEntity(), {
    id: "p-1",
    workspaceId: "ws-1",
    templateKey: "thank_payment",
    name: "Thank",
    moduleKey: "sales",
    enabled: true,
    dismissed: false,
    config: {},
    body: null,
    bodyVersion: 0,
    templateVersion: 1,
    basedOnContext: null,
    approvalStreak: 0,
    trustOfferedAt: null,
    autoSend: false,
    createdBy: null,
    createdAt: new Date("2026-10-12T00:00:00.000Z"),
    updatedAt: new Date("2026-10-12T00:00:00.000Z"),
})

/** A manager whose saving statement runs and whose read-back answers `stored`. */
const saving = (stored: AutomationPipelineEntity | null) => {
    const em = mockEntityManager({ findOne: [AutomationPipelineEntity, stored] })
    const fake = fakeQueryBuilder({ execute: {} })
    em.createQueryBuilder.mockReturnValue(fake.builder)
    return { em, fake }
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
            const em = mockEntityManager({ findOne: [AutomationPipelineEntity, ENTITY] })

            await expect((await build(em)).findPipeline("ws-1", "thank_payment")).resolves.toEqual(ROW)

            expect(em.findOne).toHaveBeenCalledWith(AutomationPipelineEntity, {
                where: { workspaceId: "ws-1", templateKey: "thank_payment" },
            })
        })

        it("answers none before the first switch", async () => {
            const em = mockEntityManager({ findOne: [AutomationPipelineEntity, null] })

            await expect((await build(em)).findPipeline("ws-1", "thank_payment")).resolves.toBeNull()
        })
    })

    describe("findPipelineById", () => {
        it("answers the pipeline, or none", async () => {
            const em = mockEntityManager({ findOne: [AutomationPipelineEntity, ENTITY] })
            const service = await build(em)

            await expect(service.findPipelineById("p-1")).resolves.toEqual(ROW)

            const empty = await build(mockEntityManager({ findOne: [AutomationPipelineEntity, null] }))
            await expect(empty.findPipelineById("p-2")).resolves.toBeNull()
        })
    })

    describe("enabledPipelines", () => {
        it("reads the pipelines of every workspace and of one workspace", async () => {
            const em = mockEntityManager({ find: [AutomationPipelineEntity, [ENTITY]] })
            const service = await build(em)

            await expect(service.enabledPipelines()).resolves.toEqual([ROW])
            await expect(service.enabledPipelinesOf("ws-1")).resolves.toEqual([ROW])

            expect(em.find).toHaveBeenNthCalledWith(1, AutomationPipelineEntity, {
                where: { enabled: true },
                order: { createdAt: "ASC" },
                take: 5000,
            })
            expect(em.find).toHaveBeenNthCalledWith(2, AutomationPipelineEntity, {
                where: { enabled: true, workspaceId: "ws-1" },
                order: { createdAt: "ASC" },
                take: 5000,
            })
        })
    })

    describe("enabledOfTemplate", () => {
        it("reads the pipelines of one template that are on, by workspace id, bounded", async () => {
            const em = mockEntityManager({ find: [AutomationPipelineEntity, [ENTITY]] })

            await expect((await build(em)).enabledOfTemplate("shifts_shift_reminder", 7)).resolves.toEqual([ROW])
            expect(em.find).toHaveBeenCalledWith(AutomationPipelineEntity, {
                where: { enabled: true, templateKey: "shifts_shift_reminder" },
                order: { workspaceId: "ASC" },
                take: 7,
            })
        })
    })

    describe("pipelineKeys", () => {
        it("reads the id and template key of each pipeline of a workspace", async () => {
            const em = mockEntityManager({
                find: [
                    AutomationPipelineEntity,
                    [Object.assign(new AutomationPipelineEntity(), { id: "p-1", templateKey: "a" })],
                ],
            })

            await expect((await build(em)).pipelineKeys("ws-1")).resolves.toEqual([{ id: "p-1", template_key: "a" }])
        })
    })
})

describe("AutomationPipelinesService", () => {
    describe("savePipeline", () => {
        it("writes the template and the columns in one statement and answers the row read back", async () => {
            const { em, fake } = saving(ENTITY)

            await expect((await build(em)).savePipeline("ws-1", "user-1", DEFINITION, WRITE)).resolves.toEqual(ROW)

            expect(em.createQueryBuilder).toHaveBeenCalledWith(AutomationPipelineEntity, "ap")
            expect(fake.callsOf("values")).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        templateKey: "thank_payment",
                        name: "Cam on",
                        moduleKey: "sales",
                        templateVersion: 5,
                        createdBy: "user-1",
                        enabled: true,
                        dismissed: false,
                        config: { hour: 9 },
                        body: "Hello",
                        bodyVersion: 2,
                        basedOnContext: 3,
                        approvalStreak: 4,
                        trustOfferedAt: null,
                        autoSend: false,
                    },
                ],
            ])
            expect(fake.callsOf("orUpdate")).toEqual([
                [expect.arrayContaining(["name", "updated_at"]), ["workspace_id", "template_key"]],
            ])
            expect(em.findOne).toHaveBeenCalledWith(AutomationPipelineEntity, {
                where: { workspaceId: "ws-1", templateKey: "thank_payment" },
            })
        })

        it("fails when the database stores nothing", async () => {
            const { em } = saving(null)

            await expect((await build(em)).savePipeline("ws-1", "user-1", DEFINITION, WRITE)).rejects.toMatchObject({
                code: AutomationPipelinesErrorCode.NotSaved,
            })
        })
    })

    describe("saveLadder", () => {
        it("records the streak and the offer", async () => {
            const em = mockEntityManager({ update: [AutomationPipelineEntity, { affected: 1 }] })

            await expect((await build(em)).saveLadder("p-1", 3, "2026-10-12T00:00:00.000Z")).resolves.toBeUndefined()

            expect(em.update).toHaveBeenCalledWith(
                AutomationPipelineEntity,
                { id: "p-1" },
                {
                    approvalStreak: 3,
                    trustOfferedAt: new Date("2026-10-12T00:00:00.000Z"),
                },
            )
        })
    })
})

const OFFERED = "2026-10-12T08:00:00.000Z"

describe("AutomationPipelinesService trust offer and clock", () => {
    it("reads the instant the trust offer was made as text", async () => {
        const stored = Object.assign(new AutomationPipelineEntity(), { ...ENTITY, trustOfferedAt: new Date(OFFERED) })
        const em = mockEntityManager({ findOne: [AutomationPipelineEntity, stored] })

        await expect((await build(em)).findPipeline("ws-1", "thank_payment")).resolves.toEqual({
            ...ROW,
            trust_offered_at: OFFERED,
        })
    })

    it("stores and answers the trust offer instant and stamps the save with the database time", async () => {
        const { em, fake } = saving(
            Object.assign(new AutomationPipelineEntity(), { ...ENTITY, trustOfferedAt: new Date(OFFERED) }),
        )

        await expect(
            (await build(em)).savePipeline("ws-1", "user-1", DEFINITION, { ...WRITE, trustOfferedAt: OFFERED }),
        ).resolves.toEqual({ ...ROW, trust_offered_at: OFFERED })

        const values = fake.callsOf("values")[0]?.[0]
        expect(evaluatedValues(values).trustOfferedAt).toEqual(new Date(OFFERED))
    })

    it("clears the offer of the ladder and stamps it with the database time", async () => {
        const em = mockEntityManager({ update: [AutomationPipelineEntity, { affected: 1 }] })

        await (await build(em)).saveLadder("p-1", 0, null)

        const values = em.update.mock.calls[0]?.[2]
        expect(evaluatedValues(values).trustOfferedAt).toBeNull()
    })
})
