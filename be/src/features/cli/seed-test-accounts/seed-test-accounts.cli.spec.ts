import { Readable } from "node:stream"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TestAccountsSeedService } from "@modules/domain/channel-provisioning"
import { SeedTestAccountsCli } from "./seed-test-accounts.cli"

describe("SeedTestAccountsCli", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("hands the whole of stdin to the test-accounts seed once", async () => {
        jest.spyOn(process, "stdin", "get").mockReturnValue(
            Object.assign(Readable.from(['{"documents":', "[]}\n"]), { fd: 0 }) as unknown as typeof process.stdin,
        )
        const seed = mock<TestAccountsSeedService>()
        seed.run.mockResolvedValue(undefined)
        const moduleRef = await Test.createTestingModule({
            providers: [SeedTestAccountsCli, { provide: TestAccountsSeedService, useValue: seed }],
        }).compile()

        await expect(moduleRef.get(SeedTestAccountsCli).run()).resolves.toBeUndefined()

        expect(seed.run.mock.calls).toEqual([['{"documents":[]}\n']])
    })
})
