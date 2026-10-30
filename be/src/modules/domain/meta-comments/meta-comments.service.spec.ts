import { builder, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { IsNull } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { evaluatedCalls } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { PageComment } from "./meta-comments.contracts"
import { MetaCommentsService } from "./meta-comments.service"
import { MetaCommentEntity } from "./persistence/entities"

/** The criterion of a private reply nobody took. */
const NOT_REPLIED: unknown = IsNull()

const COMMENT: PageComment = { connectionId: "c-1", commentId: "cm-1" }
const COMMENT_AT = "2026-10-13T00:00:00.000Z"

const serviceOf = async (primary: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [MetaCommentsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: primary }],
    }).compile()
    return moduleRef.get(MetaCommentsService)
}

const entityOf = builder<MetaCommentEntity>({
    connectionId: "c-1",
    commentId: "cm-1",
    platform: "facebook",
    commentAt: new Date(COMMENT_AT),
    privateRepliedAt: null,
    createdAt: new Date(COMMENT_AT),
    updatedAt: new Date(COMMENT_AT),
})

describe("MetaCommentsService", () => {
    it("notes the comment once in the given transaction", async () => {
        const primary = mockEntityManager()
        const tx = mockEntityManager()
        const [fake] = queueQueryBuilders(tx, [{ execute: {} }])
        const comment = { connectionId: "c-1", commentId: "cm-1", platform: "instagram", at: COMMENT_AT }

        await expect((await serviceOf(primary)).note(comment, tx)).resolves.toBeUndefined()

        expect(fake?.callsOf("insert")).toEqual([[]])
        expect(fake?.callsOf("values")).toEqual([
            [{ connectionId: "c-1", commentId: "cm-1", platform: "instagram", commentAt: new Date(COMMENT_AT) }],
        ])
        expect(fake?.callsOf("orIgnore")).toHaveLength(1)
        expect(primary.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("reads when a comment was made and whether its private reply was taken", async () => {
        const primary = mockEntityManager({
            findOne: [
                MetaCommentEntity,
                Object.assign(entityOf(), { privateRepliedAt: new Date("2026-10-13T01:00:00.000Z") }),
            ],
        })

        await expect((await serviceOf(primary)).replyState(COMMENT)).resolves.toEqual({
            commentAt: Date.parse(COMMENT_AT),
            replied: true,
        })

        expect(primary.findOne).toHaveBeenCalledWith(MetaCommentEntity, {
            select: { commentAt: true, privateRepliedAt: true },
            where: { connectionId: "c-1", commentId: "cm-1" },
        })
    })

    it("reads an unknown comment or an unparseable instant as unknown and not replied", async () => {
        const primary = mockEntityManager({
            findOne: [
                [MetaCommentEntity, null],
                [MetaCommentEntity, Object.assign(entityOf(), { commentAt: "not-a-date" })],
            ],
        })
        const comments = await serviceOf(primary)

        await expect(comments.replyState(COMMENT)).resolves.toEqual({ commentAt: null, replied: false })
        await expect(comments.replyState(COMMENT)).resolves.toEqual({ commentAt: null, replied: false })
    })
})

describe("MetaCommentsService claims", () => {
    it("claims the private reply only when a row was changed", async () => {
        const primary = mockEntityManager({
            update: [
                [MetaCommentEntity, { affected: 1 }],
                [MetaCommentEntity, { affected: 0 }],
                [MetaCommentEntity, {}],
            ],
        })
        const comments = await serviceOf(primary)

        await expect(comments.claim(COMMENT)).resolves.toBe(true)
        await expect(comments.claim(COMMENT)).resolves.toBe(false)
        await expect(comments.claim(COMMENT)).resolves.toBe(false)

        const claimed = [
            "MetaCommentEntity",
            { ...COMMENT, privateRepliedAt: NOT_REPLIED },
            { privateRepliedAt: "now()" },
        ]
        expect(evaluatedCalls(primary.update.mock.calls, 2)).toEqual([claimed, claimed, claimed])
    })

    it("gives the private reply back", async () => {
        const primary = mockEntityManager({ update: [MetaCommentEntity, { affected: 1 }] })

        await expect((await serviceOf(primary)).release(COMMENT)).resolves.toBeUndefined()

        expect(primary.update).toHaveBeenCalledWith(
            MetaCommentEntity,
            { connectionId: "c-1", commentId: "cm-1" },
            { privateRepliedAt: null },
        )
    })
})
