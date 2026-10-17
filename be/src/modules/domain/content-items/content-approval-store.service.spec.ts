import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { ContentSubmissionSnapshot } from "./content-approval-store.contracts"
import { ContentApprovalStoreService } from "./content-approval-store.service"
import type { ContentEvidence, PublishMark } from "./content-editor.contracts"
import { ContentItemsErrorCode } from "./errors/content-items.error"
import {
    APPROVE_CONTENT_SUBMISSION,
    CLAIM_CONTENT_SUBMISSION,
    MARK_CONTENT_PUBLISHED,
    REJECT_CONTENT_SUBMISSION,
} from "./persistence/content-approval-store.sql"

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

const build = async () => {
    const entityManager = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [ContentApprovalStoreService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(ContentApprovalStoreService), entityManager }
}

describe("ContentApprovalStoreService", () => {
    describe("claimSubmission", () => {
        it("claimSubmission exercises its first behavior through the compiled module", async () => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([])

            await expect(
                service.claimSubmission("workspace", "post", "work", evidence, snapshot),
            ).rejects.toMatchObject({
                code: ContentItemsErrorCode.WrongStatus,
            })

            expect(service.claimSubmission).toBeInstanceOf(Function)
        })

        it("claims the exact submitted draft and serializes its evidence", async () => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([{ id: "post" }])

            await expect(
                service.claimSubmission("workspace", "post", "work", evidence, snapshot),
            ).resolves.toBeUndefined()

            expect(entityManager.query).toHaveBeenCalledTimes(1)
            expect(entityManager.query).toHaveBeenCalledWith(CLAIM_CONTENT_SUBMISSION, [
                "workspace",
                "post",
                "work",
                JSON.stringify(evidence),
                JSON.stringify(snapshot.variants),
                ["facebook"],
            ])
        })

        it("rejects a claim when its guarded write returns no row", async () => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([])

            await expect(
                service.claimSubmission("workspace", "post", "work", evidence, snapshot),
            ).rejects.toMatchObject({
                code: ContentItemsErrorCode.WrongStatus,
            })
        })
    })
})

describe("ContentApprovalStoreService", () => {
    describe("approve", () => {
        it("approve exercises its first behavior through the compiled module", async () => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([])

            await expect(
                service.approve("workspace", "post", "work", "Approver", null, evidence),
            ).rejects.toMatchObject({
                code: ContentItemsErrorCode.WrongStatus,
            })

            expect(service.approve).toBeInstanceOf(Function)
        })

        it.each([null, "  Edited draft  "])("approves using the unmodified draft %p", async (draft) => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([{ id: "post" }])

            await expect(
                service.approve("workspace", "post", "work", "Approver", draft, evidence),
            ).resolves.toBeUndefined()

            expect(entityManager.query).toHaveBeenCalledTimes(1)
            expect(entityManager.query).toHaveBeenCalledWith(APPROVE_CONTENT_SUBMISSION, [
                "workspace",
                "post",
                "work",
                "Approver",
                draft,
                JSON.stringify(evidence),
                evidence.at,
            ])
        })

        it.each(["", " \t\n "])("rejects blank edited text %p before accessing persistence", async (draft) => {
            const { service, entityManager } = await build()

            await expect(
                service.approve("workspace", "post", "work", "Approver", draft, evidence),
            ).rejects.toMatchObject({
                code: ContentItemsErrorCode.TextMissing,
            })

            expect(entityManager.query).not.toHaveBeenCalled()
        })

        it("rejects an approval when its work item no longer owns a waiting post", async () => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([])

            await expect(
                service.approve("workspace", "post", "work", "Approver", null, evidence),
            ).rejects.toMatchObject({
                code: ContentItemsErrorCode.WrongStatus,
            })
        })
    })
})

describe("ContentApprovalStoreService", () => {
    describe("reject", () => {
        it("reject exercises its first behavior through the compiled module", async () => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([])

            await expect(service.reject("workspace", "post", "work", evidence)).rejects.toMatchObject({
                code: ContentItemsErrorCode.WrongStatus,
            })

            expect(service.reject).toBeInstanceOf(Function)
        })

        it("returns a waiting post to draft with the supplied work item and evidence", async () => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([{ id: "post" }])

            await expect(service.reject("workspace", "post", "work", evidence)).resolves.toBeUndefined()

            expect(entityManager.query).toHaveBeenCalledTimes(1)
            expect(entityManager.query).toHaveBeenCalledWith(REJECT_CONTENT_SUBMISSION, [
                "workspace",
                "post",
                "work",
                JSON.stringify(evidence),
            ])
        })

        it("rejects the transition when no waiting post matches", async () => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([])

            await expect(service.reject("workspace", "post", "work", evidence)).rejects.toMatchObject({
                code: ContentItemsErrorCode.WrongStatus,
            })
        })
    })
})

describe("ContentApprovalStoreService", () => {
    describe("markPublished", () => {
        it("markPublished exercises its first behavior through the compiled module", async () => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([])

            await expect(service.markPublished("workspace", "post", "facebook", mark, evidence)).rejects.toMatchObject({
                code: ContentItemsErrorCode.WrongStatus,
            })

            expect(service.markPublished).toBeInstanceOf(Function)
        })

        it.each([false, true])("returns the stored publication result with allDone=%p", async (allDone) => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([{ id: "post", allDone }])

            await expect(service.markPublished("workspace", "post", "facebook", mark, evidence)).resolves.toEqual({
                id: "post",
                allDone,
            })

            expect(entityManager.query).toHaveBeenCalledTimes(1)
            expect(entityManager.query).toHaveBeenCalledWith(MARK_CONTENT_PUBLISHED, [
                "workspace",
                "post",
                "facebook",
                JSON.stringify(mark),
                JSON.stringify(evidence),
                mark.at,
            ])
        })

        it("rejects publication when the guarded write finds no approved post", async () => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([])

            await expect(service.markPublished("workspace", "post", "facebook", mark, evidence)).rejects.toMatchObject({
                code: ContentItemsErrorCode.WrongStatus,
            })
        })
    })
})
