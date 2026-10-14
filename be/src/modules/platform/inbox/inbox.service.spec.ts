import { Test } from "@nestjs/testing"
import { InboxService } from "./inbox.service"

describe("InboxService", () => {
    const build = async () => {
        const moduleRef = await Test.createTestingModule({ providers: [InboxService] }).compile()
        return moduleRef.get(InboxService)
    }

    it("accepts a delivery so the domain row can record it", async () => {
        const inbox = await build()

        await expect(inbox.claim("zalo", "evt-1")).resolves.toBe(true)
    })

    it("refuses a delivery that names neither a source nor an event", async () => {
        const inbox = await build()

        await expect(inbox.claim("", "")).resolves.toBe(false)
    })
})
