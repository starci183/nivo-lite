import { Test } from "@nestjs/testing"
import { RandomIdsService } from "./random-ids.service"

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u

describe("RandomIdsService", () => {
    it("returns a version 4 UUID", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [RandomIdsService] }).compile()

        expect(moduleRef.get(RandomIdsService).next()).toMatch(UUID_V4)
    })

    it("returns a different id on every call", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [RandomIdsService] }).compile()
        const ids = moduleRef.get(RandomIdsService)

        expect(ids.next()).not.toBe(ids.next())
    })
})
