import { Test } from "@nestjs/testing"
import { fakeInbox, mockEntityManager } from "@starci/jest-preset"
import { INBOX } from "@modules/platform/inbox"
import { VietcombankReceiptService } from "./vietcombank-inbox.service"
import type { SimulatedReceiptPayload } from "./vietcombank-inbox.contracts"
import {
    INSERT_VIETCOMBANK_INBOX,
    FIND_PENDING_VIETCOMBANK_INBOX,
    COMPLETE_VIETCOMBANK_INBOX,
} from "./persistence/vietcombank-inbox.sql"

const payload: SimulatedReceiptPayload = {
    workspaceId: "ws-1",
    credit: { amount: 1000, content: "payment", sender: null, eventId: "bank-1" },
}
const pending = { id: "receipt-1", payload }

const build = async (rows = [pending]) => {
    const manager = mockEntityManager({
        query: [
            [FIND_PENDING_VIETCOMBANK_INBOX, rows],
            [COMPLETE_VIETCOMBANK_INBOX, []],
        ],
    })
    const inbox = fakeInbox()
    const claim = jest.spyOn(inbox, "claim")
    const moduleRef = await Test.createTestingModule({
        providers: [VietcombankReceiptService, { provide: INBOX, useValue: inbox }],
    }).compile()
    return { service: moduleRef.get(VietcombankReceiptService), inbox, claim, manager }
}

describe("VietcombankReceiptService", () => {
    it.each([true, false])("returns the claim result %s in the caller's transaction", async (claimed) => {
        const { service, inbox, claim, manager } = await build()
        if (!claimed) inbox.seen("vietcombank", "delivery-1")
        await expect(service.claim(manager, "delivery-1", payload)).resolves.toBe(claimed)
        expect(claim).toHaveBeenCalledWith("vietcombank", "delivery-1", manager, {
            insert: INSERT_VIETCOMBANK_INBOX,
            payload,
        })
        expect(manager.query).not.toHaveBeenCalled()
    })

    it("returns the receipt locked by the supplied manager", async () => {
        const { service, manager } = await build()
        await expect(service.lock(manager, "delivery-1")).resolves.toEqual(pending)
        expect(manager.query).toHaveBeenCalledWith(FIND_PENDING_VIETCOMBANK_INBOX, ["delivery-1"])
    })

    it("returns undefined for a missing or completed receipt", async () => {
        const { service, manager } = await build([])
        await expect(service.lock(manager, "delivery-1")).resolves.toBeUndefined()
        expect(manager.query).toHaveBeenCalledTimes(1)
    })

    it("completes the receipt with the supplied manager", async () => {
        const { service, manager } = await build()
        await expect(service.complete(manager, "receipt-1")).resolves.toBeUndefined()
        expect(manager.query).toHaveBeenCalledWith(COMPLETE_VIETCOMBANK_INBOX, ["receipt-1"])
    })

    it("propagates a refused claim to the transaction owner", async () => {
        const { service, inbox, manager } = await build()
        const failure = new Error("claim failed")
        inbox.failNext("claim", failure)
        await expect(service.claim(manager, "delivery-1", payload)).rejects.toBe(failure)
    })

    it.each(["lock", "complete"])("propagates a failed %s to the transaction owner", async (operation) => {
        const { service, manager } = await build()
        const failure = new Error("database failed")
        manager.query.mockRejectedValue(failure)
        const result =
            operation === "lock" ? service.lock(manager, "delivery-1") : service.complete(manager, "receipt-1")
        await expect(result).rejects.toBe(failure)
    })
})
