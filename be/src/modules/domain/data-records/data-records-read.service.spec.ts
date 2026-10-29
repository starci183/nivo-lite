import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DataRecordsReadService } from "./data-records-read.service"
import { DataRecordEntity } from "./persistence/entities"

const MAIL = { id: "rec-1", attachments: [{ xml: "<x/>" }] }

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [DataRecordsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(DataRecordsReadService)
}

describe("DataRecordsReadService", () => {
    it("reads the newest mails with an XML attachment from a date on, bounded", async () => {
        const em = mockEntityManager()
        const [mails] = queueQueryBuilders(em, [{ getRawMany: [MAIL] }])

        await expect((await build(em)).mailsWithXml("ws-1", "2026-10-01", 200)).resolves.toEqual([MAIL])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(DataRecordEntity, "r")
        expect(mails?.callsOf("where")).toEqual([
            ["r.workspace_id = :workspaceId AND r.entity = 'message'", { workspaceId: "ws-1" }],
        ])
        expect(mails?.callsOf("andWhere")).toEqual([
            [
                "jsonb_path_exists(r.data, CAST(:attachmentsPath AS jsonpath))",
                { attachmentsPath: "$.attachments[*].xml" },
            ],
            ["r.occurred_at >= CAST(:since AS date)", { since: "2026-10-01" }],
        ])
        expect(mails?.callsOf("orderBy")).toEqual([["r.occurred_at", "DESC", "NULLS LAST"]])
        expect(mails?.callsOf("limit")).toEqual([[200]])
    })

    it("reads from the start of the mailbox when no date is given", async () => {
        const em = mockEntityManager()
        const [mails] = queueQueryBuilders(em, [{ getRawMany: [] }])

        await expect((await build(em)).mailsWithXml("ws-1", undefined, 200)).resolves.toEqual([])
        expect(mails?.callsOf("andWhere")).toHaveLength(1)
    })

    it("reads one mail of the workspace by its id", async () => {
        const em = mockEntityManager()
        const [mails] = queueQueryBuilders(em, [{ getRawMany: [MAIL] }])

        await expect((await build(em)).mailAttachments("ws-1", "rec-1")).resolves.toEqual(MAIL)
        expect(mails?.callsOf("andWhere")).toEqual([["CAST(r.id AS text) = :recordId", { recordId: "rec-1" }]])
        expect(mails?.callsOf("limit")).toEqual([[1]])
    })

    it("answers nothing for a mail the workspace does not hold", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawMany: [] }])

        await expect((await build(em)).mailAttachments("ws-1", "rec-9")).resolves.toBeUndefined()
    })
})
