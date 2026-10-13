import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { PageComment } from "./meta-comments.contracts"
import { MetaCommentsService } from "./meta-comments.service"
import {
    CLAIM_PRIVATE_REPLY,
    FIND_META_COMMENT,
    NOTE_META_COMMENT,
    RELEASE_PRIVATE_REPLY,
} from "./persistence/meta-comments.sql"

const COMMENT: PageComment = { connectionId: "c-1", commentId: "cm-1" }
const COMMENT_AT = "2026-10-13T00:00:00.000Z"

const build = async (stubs: ReadonlyArray<readonly [string, unknown]>) => {
    const primary = mockEntityManager({ query: stubs })
    const moduleRef = await Test.createTestingModule({
        providers: [MetaCommentsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: primary }],
    }).compile()
    return { comments: moduleRef.get(MetaCommentsService), primary }
}

describe("MetaCommentsService", () => {
    it("notes the comment in the given transaction", async () => {
        const primary = mockEntityManager()
        const tx = mockEntityManager({ query: [NOTE_META_COMMENT, []] })
        const moduleRef = await Test.createTestingModule({
            providers: [MetaCommentsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: primary }],
        }).compile()
        const comment = {
            connectionId: "c-1",
            commentId: "cm-1",
            platform: "instagram",
            at: "2026-10-13T00:00:00.000Z",
        }

        await expect(moduleRef.get(MetaCommentsService).note(comment, tx)).resolves.toBeUndefined()

        expect(tx.query).toHaveBeenCalledWith(NOTE_META_COMMENT, [
            "c-1",
            "cm-1",
            "instagram",
            "2026-10-13T00:00:00.000Z",
        ])
        expect(primary.query).not.toHaveBeenCalled()
    })

    it("reads when a comment was made and whether its private reply was taken", async () => {
        const { comments, primary } = await build([
            [FIND_META_COMMENT, [{ comment_at: new Date(COMMENT_AT), private_replied_at: "2026-10-13T01:00:00.000Z" }]],
        ])

        await expect(comments.replyState(COMMENT)).resolves.toEqual({
            commentAt: Date.parse(COMMENT_AT),
            replied: true,
        })

        expect(primary.query).toHaveBeenCalledWith(FIND_META_COMMENT, ["c-1", "cm-1"])
    })

    it("reads an unknown comment or an unparseable instant as unknown and not replied", async () => {
        const { comments } = await build([
            [FIND_META_COMMENT, []],
            [FIND_META_COMMENT, [{ comment_at: "not-a-date", private_replied_at: null }]],
        ])

        await expect(comments.replyState(COMMENT)).resolves.toEqual({ commentAt: null, replied: false })
        await expect(comments.replyState(COMMENT)).resolves.toEqual({ commentAt: null, replied: false })
    })

    it("claims the private reply only when a row comes back", async () => {
        const { comments, primary } = await build([
            [CLAIM_PRIVATE_REPLY, [{ comment_id: "cm-1" }]],
            [CLAIM_PRIVATE_REPLY, []],
        ])

        await expect(comments.claim(COMMENT)).resolves.toBe(true)
        await expect(comments.claim(COMMENT)).resolves.toBe(false)

        expect(primary.query).toHaveBeenCalledWith(CLAIM_PRIVATE_REPLY, ["c-1", "cm-1"])
    })

    it("gives the private reply back", async () => {
        const { comments, primary } = await build([[RELEASE_PRIVATE_REPLY, []]])

        await expect(comments.release(COMMENT)).resolves.toBeUndefined()

        expect(primary.query).toHaveBeenCalledWith(RELEASE_PRIVATE_REPLY, ["c-1", "cm-1"])
    })
})
