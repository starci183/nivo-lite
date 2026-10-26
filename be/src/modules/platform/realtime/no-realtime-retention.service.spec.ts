import { Test } from "@nestjs/testing"
import { NoRealtimeRetentionService } from "./no-realtime-retention.service"

describe("NoRealtimeRetentionService.sweep", () => {
    it("acknowledges the tick and deletes nothing", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [NoRealtimeRetentionService] }).compile()

        await expect(moduleRef.get(NoRealtimeRetentionService).sweep()).resolves.toBe(0)
    })
})
