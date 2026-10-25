import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { OfficeReadMarkersService } from "./office-read-markers.service"
import { ADVANCE_ROOM_READ_CURSOR } from "./persistence/office-read-markers.sql"

describe("OfficeReadMarkersService", () => {
    it("writes the persisted cursor through the caller's transaction instead of a separate connection", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [OfficeReadMarkersService] }).compile()
        const manager = mockEntityManager({ query: [ADVANCE_ROOM_READ_CURSOR, []] })

        await moduleRef
            .get(OfficeReadMarkersService)
            .advance("workspace", "account", "sales", "2026-10-25T01:00:00Z", manager)

        expect(manager.query).toHaveBeenCalledWith(ADVANCE_ROOM_READ_CURSOR, [
            "workspace",
            "account",
            "sales",
            "2026-10-25T01:00:00Z",
        ])
    })

    it("lets the caller's transaction roll back by surfacing a failed cursor write", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [OfficeReadMarkersService] }).compile()
        const failure = new Error("cursor write failed")
        const manager = mockEntityManager({ query: [ADVANCE_ROOM_READ_CURSOR, []] })
        manager.query.mockRejectedValue(failure)

        await expect(
            moduleRef
                .get(OfficeReadMarkersService)
                .advance("workspace", "account", "sales", "2026-10-25T01:00:00Z", manager),
        ).rejects.toBe(failure)
    })
})
