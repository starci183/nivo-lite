import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { VideoProjectEntity } from "./persistence/entities"
import { VideoProjectScriptingService } from "./video-project-scripting.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [VideoProjectScriptingService] }).compile()
    return moduleRef.get(VideoProjectScriptingService)
}

/** A transaction double whose only query builder records the chain. */
const transaction = () => {
    const tx = mockEntityManager()
    const fake = fakeQueryBuilder({ execute: { raw: [] } })
    tx.createQueryBuilder.mockReturnValue(fake.builder)
    return { tx, fake }
}

const GUARD =
    "workspace_id = :workspaceId AND id = :projectId AND status = 'scripting' AND script_meta ->> 'generation_id' = :generationId"

describe("VideoProjectScriptingService", () => {
    describe("start", () => {
        it("stores the operation metadata in the caller's transaction", async () => {
            const { tx, fake } = transaction()
            const service = await build()

            await expect(service.start(tx, "workspace-1", "project-1", '{"attempts":1}')).resolves.toBeUndefined()

            expect(tx.createQueryBuilder).toHaveBeenCalledWith(VideoProjectEntity, "v")

            expect(fake.callsOf("update")).toEqual([[]])
            expect(fake.callsOf("set").map(([set]) => evaluatedValues(set))).toEqual([
                { status: "scripting", lastError: null, scriptMeta: "CAST(:meta AS jsonb)" },
            ])
            expect(fake.callsOf("where")).toEqual([
                [
                    "workspace_id = :workspaceId AND id = :projectId",
                    { workspaceId: "workspace-1", projectId: "project-1" },
                ],
            ])
            expect(fake.callsOf("setParameter")).toEqual([["meta", '{"attempts":1}']])
        })
    })

    describe("finish", () => {
        it("stores the scenes, the timing and the automatic title of the owning generation and drops the approval", async () => {
            const { tx, fake } = transaction()
            const service = await build()

            await expect(
                service.finish(tx, {
                    workspaceId: "workspace-1",
                    projectId: "project-1",
                    generationId: "generation-1",
                    script: "[]",
                    durationMs: 1200,
                    title: "Spring offer",
                    meta: "{}",
                }),
            ).resolves.toBeUndefined()

            expect(fake.callsOf("set").map(([set]) => evaluatedValues(set))).toEqual([
                {
                    status: "draft",
                    script: "CAST(:script AS jsonb)",
                    scriptMs: 1200,
                    title: "coalesce(CAST(:title AS text), title)",
                    lastError: null,
                    scriptMeta: "CAST(:meta AS jsonb)",
                    approvedAt: null,
                    approvedByName: null,
                    publishedAt: null,
                },
            ])
            expect(fake.callsOf("where")).toEqual([
                [GUARD, { workspaceId: "workspace-1", projectId: "project-1", generationId: "generation-1" }],
            ])
            expect(fake.callsOf("setParameters")).toEqual([[{ script: "[]", title: "Spring offer", meta: "{}" }]])
        })
    })
})

describe("VideoProjectScriptingService failures", () => {
    describe("fail", () => {
        it("stores the stable failure code of the owning generation", async () => {
            const { tx, fake } = transaction()
            const service = await build()

            await expect(
                service.fail(tx, {
                    workspaceId: "workspace-1",
                    projectId: "project-1",
                    generationId: "generation-1",
                    code: "code:VIDEO_SCRIPT_FAILED",
                    meta: "{}",
                }),
            ).resolves.toBeUndefined()

            expect(fake.callsOf("set").map(([set]) => evaluatedValues(set))).toEqual([
                { status: "draft", lastError: "code:VIDEO_SCRIPT_FAILED", scriptMeta: "CAST(:meta AS jsonb)" },
            ])
            expect(fake.callsOf("where")).toEqual([
                [GUARD, { workspaceId: "workspace-1", projectId: "project-1", generationId: "generation-1" }],
            ])
            expect(fake.callsOf("setParameter")).toEqual([["meta", "{}"]])
        })
    })
})
