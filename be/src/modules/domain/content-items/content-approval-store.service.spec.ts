import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import type { ContentSubmissionSnapshot } from "./content-approval-store.contracts"
import { ContentApprovalStoreService } from "./content-approval-store.service"
import type { ContentEvidence, PublishMark } from "./content-editor.contracts"
import { ContentItemsErrorCode } from "./errors/content-items.error"
import { ContentItemEntity } from "./persistence/entities"

const evidence: ContentEvidence = {
    at: "2026-10-14T12:00:00.000Z",
    kind: "approval",
    by: "Editor",
    text: "Ready for review",
}

const snapshot: ContentSubmissionSnapshot = {
    variants: { facebook: { text: "Draft text", hashtags: ["#news"], note: "Friendly" } },
    channels: ["facebook"],
}

const mark: PublishMark = {
    at: "2026-10-14T13:00:00.000Z",
    by: "Publisher",
    url: "https://example.com/published",
    how: "manual",
}

const written = { execute: { raw: [{ id: "post" }] } }
const nothing = { execute: { raw: [] } }

const build = async (answers: ReadonlyArray<QueryBuilderAnswers> = []) => {
    const entityManager = mockEntityManager()
    const fakes = queueQueryBuilders(entityManager, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [ContentApprovalStoreService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(ContentApprovalStoreService), entityManager, fakes }
}

/** The SQL that appends one history line and keeps the newest sixty. */
const evidenceSql = (parameter: string): string =>
    `(SELECT jsonb_agg(line ORDER BY ord) FROM jsonb_array_elements(evidence || jsonb_build_array(:${parameter}::jsonb)) WITH ORDINALITY AS history(line, ord) WHERE ord > jsonb_array_length(evidence || jsonb_build_array(:${parameter}::jsonb)) - 60)`

describe("ContentApprovalStoreService", () => {
    describe("claimSubmission", () => {
        it("claims the exact submitted draft and serializes its evidence", async () => {
            const { service, entityManager, fakes } = await build([written])

            await expect(
                service.claimSubmission("workspace", "post", "work", evidence, snapshot),
            ).resolves.toBeUndefined()

            expect(entityManager.createQueryBuilder).toHaveBeenCalledTimes(1)
            expect(entityManager.createQueryBuilder).toHaveBeenCalledWith(ContentItemEntity, "ci")
            expect(evaluatedValues(fakes[0]?.callsOf("set")[0]?.[0])).toEqual({
                status: "waiting_approval",
                workItemId: "work",
                evidence:
                    "(SELECT jsonb_agg(line ORDER BY ord) FROM jsonb_array_elements(evidence || jsonb_build_array(:evidence::jsonb)) WITH ORDINALITY AS history(line, ord) WHERE ord > jsonb_array_length(evidence || jsonb_build_array(:evidence::jsonb)) - 60)",
            })
            expect(fakes[0]?.callsOf("where")).toEqual([[{ workspaceId: "workspace", id: "post", status: "draft" }]])
            expect(fakes[0]?.callsOf("setParameters")).toEqual([
                [
                    {
                        evidence: JSON.stringify(evidence),
                        variants: JSON.stringify(snapshot.variants),
                        channels: ["facebook"],
                    },
                ],
            ])
        })

        it("rejects a claim when its guarded write returns no row", async () => {
            const { service } = await build([nothing])

            await expect(
                service.claimSubmission("workspace", "post", "work", evidence, snapshot),
            ).rejects.toMatchObject({ code: ContentItemsErrorCode.WrongStatus })
        })
    })

    describe("approve", () => {
        it.each([null, "  Edited draft  "])("approves using the unmodified draft %p", async (draft) => {
            const { service, entityManager, fakes } = await build([written])

            await expect(
                service.approve("workspace", "post", "work", "Approver", draft, evidence),
            ).resolves.toBeUndefined()

            expect(entityManager.createQueryBuilder).toHaveBeenCalledTimes(1)
            expect(evaluatedValues(fakes[0]?.callsOf("set")[0]?.[0])).toMatchObject({
                status: "approved",
                approvedBy: "Approver",
            })
            expect(fakes[0]?.callsOf("where")).toEqual([
                [{ workspaceId: "workspace", id: "post", status: "waiting_approval", workItemId: "work" }],
            ])
            expect(fakes[0]?.callsOf("setParameters")).toEqual([
                [{ at: evidence.at, draft, evidence: JSON.stringify(evidence) }],
            ])
        })

        it.each(["", " \t\n "])("rejects blank edited text %p before accessing persistence", async (draft) => {
            const { service, entityManager } = await build()

            await expect(
                service.approve("workspace", "post", "work", "Approver", draft, evidence),
            ).rejects.toMatchObject({
                code: ContentItemsErrorCode.TextMissing,
            })

            expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("rejects an approval when its work item no longer owns a waiting post", async () => {
            const { service } = await build([nothing])

            await expect(
                service.approve("workspace", "post", "work", "Approver", null, evidence),
            ).rejects.toMatchObject({ code: ContentItemsErrorCode.WrongStatus })
        })
    })

    describe("reject", () => {
        it("returns a waiting post to draft with the supplied work item and evidence", async () => {
            const { service, fakes } = await build([written])

            await expect(service.reject("workspace", "post", "work", evidence)).resolves.toBeUndefined()

            expect(evaluatedValues(fakes[0]?.callsOf("set")[0]?.[0])).toEqual({
                status: "draft",
                evidence:
                    "(SELECT jsonb_agg(line ORDER BY ord) FROM jsonb_array_elements(evidence || jsonb_build_array(:evidence::jsonb)) WITH ORDINALITY AS history(line, ord) WHERE ord > jsonb_array_length(evidence || jsonb_build_array(:evidence::jsonb)) - 60)",
            })
            expect(fakes[0]?.callsOf("where")).toEqual([
                [{ workspaceId: "workspace", id: "post", status: "waiting_approval", workItemId: "work" }],
            ])
            expect(fakes[0]?.callsOf("setParameter")).toEqual([["evidence", JSON.stringify(evidence)]])
        })

        it("rejects the transition when no waiting post matches", async () => {
            const { service } = await build([nothing])

            await expect(service.reject("workspace", "post", "work", evidence)).rejects.toMatchObject({
                code: ContentItemsErrorCode.WrongStatus,
            })
        })
    })

    describe("markPublished", () => {
        it.each([false, true])("returns the stored publication result with allDone=%p", async (allDone) => {
            const { service, fakes } = await build([{ execute: { raw: [{ id: "post", allDone }] } }])

            await expect(service.markPublished("workspace", "post", "facebook", mark, evidence)).resolves.toEqual({
                id: "post",
                allDone,
            })

            expect(fakes[0]?.callsOf("setParameters")).toEqual([
                [
                    {
                        channel: "facebook",
                        mark: JSON.stringify(mark),
                        evidence: JSON.stringify(evidence),
                        at: mark.at,
                    },
                ],
            ])
            expect(fakes[0]?.callsOf("returning")).toEqual([["id, status = 'published' AS \"allDone\""]])
            const merged = "(published || jsonb_build_object(:channel::text, :mark::jsonb))"
            expect(evaluatedValues(fakes[0]?.callsOf("set")[0]?.[0])).toEqual({
                published: merged,
                status: `CASE WHEN ${merged} ?& channels THEN 'published' ELSE status END`,
                publishedAt: `CASE WHEN ${merged} ?& channels THEN :at::timestamptz ELSE published_at END`,
                evidence: evidenceSql("evidence"),
            })
        })

        it.each([[[]], [[{ id: "post", allDone: "yes" }]]])(
            "rejects publication when the guarded write finds no approved post (%j)",
            async (raw) => {
                const { service } = await build([{ execute: { raw } }])

                await expect(
                    service.markPublished("workspace", "post", "facebook", mark, evidence),
                ).rejects.toMatchObject({
                    code: ContentItemsErrorCode.WrongStatus,
                })
            },
        )
    })
})
