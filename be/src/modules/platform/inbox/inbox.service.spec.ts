import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { InboxService } from "./inbox.service"
import { INSERT_INBOX_CLAIM } from "./persistence/inbox.sql"

type ClaimRow = { readonly delivery_id: string }

const build = async (rows: Array<ClaimRow> = [{ delivery_id: "evt-1" }]) => {
    const manager = mockEntityManager({ query: [INSERT_INBOX_CLAIM, rows] })
    const moduleRef = await Test.createTestingModule({
        providers: [InboxService, { provide: PRIMARY_ENTITY_MANAGER, useValue: manager }],
    }).compile()
    return { inbox: moduleRef.get(InboxService), manager }
}

describe("InboxService", () => {
    it("accepts a delivery so the domain row can record it", async () => {
        const { inbox, manager } = await build()
        await expect(inbox.claim("zalo", "evt-1")).resolves.toBe(true)
        expect(manager.query).toHaveBeenCalledWith(INSERT_INBOX_CLAIM, ["zalo", "evt-1"])
    })

    it("refuses an already claimed delivery", async () => {
        const { inbox } = await build([])
        await expect(inbox.claim("zalo", "evt-1")).resolves.toBe(false)
    })

    it.each([
        ["", "evt-1"],
        ["zalo", ""],
        ["zalo", "   "],
    ])("refuses an incomplete delivery key (%s, %s)", async (source, eventId) => {
        const { inbox, manager } = await build()
        await expect(inbox.claim(source, eventId)).resolves.toBe(false)
        expect(manager.query).not.toHaveBeenCalled()
    })

    it("records the provider receipt through the caller transaction", async () => {
        const { inbox, manager } = await build()
        const transaction = mockEntityManager({ query: [INSERT_INBOX_CLAIM, [{ id: "receipt-1" }]] })
        const receipt = { insert: INSERT_INBOX_CLAIM, payload: { text: "hello" } }
        await expect(inbox.claim("zalo", "evt-1", transaction, receipt)).resolves.toBe(true)
        expect(transaction.query).toHaveBeenCalledWith(INSERT_INBOX_CLAIM, ["zalo", "evt-1", '{"text":"hello"}'])
        expect(manager.query).not.toHaveBeenCalled()
    })

    it("refuses a duplicate provider receipt", async () => {
        const { inbox } = await build()
        const transaction = mockEntityManager({ query: [INSERT_INBOX_CLAIM, []] })
        await expect(
            inbox.claim("zalo", "evt-1", transaction, { insert: INSERT_INBOX_CLAIM, payload: {} }),
        ).resolves.toBe(false)
    })

    it("requires both a transaction and a receipt for provider intake", async () => {
        const { inbox, manager } = await build()
        await expect(inbox.claim("zalo", "evt-1", manager)).resolves.toBe(false)
        await expect(
            inbox.claim("zalo", "evt-1", undefined, { insert: INSERT_INBOX_CLAIM, payload: {} }),
        ).resolves.toBe(false)
        expect(manager.query).not.toHaveBeenCalled()
    })
})
