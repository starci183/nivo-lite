import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { LeadDeskService } from "./lead-desk.service"
import { LeadReadService } from "./lead-read.service"
import { LeadRecordsService } from "./lead-records.service"

const build = async () => {
    const reads = mock<LeadReadService>()
    const records = mock<LeadRecordsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadDeskService,
            { provide: LeadReadService, useValue: reads },
            { provide: LeadRecordsService, useValue: records },
        ],
    }).compile()
    return { desk: moduleRef.get(LeadDeskService), reads, records }
}

describe("LeadDeskService", () => {
    it("answers the cards of the given customers without the fields the journal does not show", async () => {
        const { desk, reads } = await build()
        reads.cardsOf.mockResolvedValue([
            { id: "l1", contactName: "An", company: "ACME", channel: "zalo", stage: "new", email: "an@example.com" },
        ])

        await expect(desk.cardsOf("ws-1", ["l1"])).resolves.toEqual([
            { id: "l1", contactName: "An", company: "ACME", stage: "new" },
        ])
        expect(reads.cardsOf).toHaveBeenCalledWith("ws-1", ["l1"])
    })

    it("holds a customer in the caller's transaction", async () => {
        const { desk, records } = await build()
        const manager = mockEntityManager()
        records.hold.mockResolvedValue(true)

        await expect(desk.hold("ws-1", "l1", manager)).resolves.toBe(true)
        expect(records.hold).toHaveBeenCalledWith("ws-1", "l1", manager)
    })
})
