import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MetaCommentsService } from "./meta-comments.service"
import { NOTE_META_COMMENT } from "./persistence/meta-comments.sql"

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
})
