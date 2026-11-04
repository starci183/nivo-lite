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
        const chunks = Readable.from(['{"documents":', "[]}\n"])
        const stdin = mock<typeof process.stdin>({ [Symbol.asyncIterator]: () => chunks[Symbol.asyncIterator]() })
        jest.spyOn(process, "stdin", "get").mockReturnValue(stdin)
        const seed = mock<TestAccountsSeedService>()
        seed.run.mockResolvedValue(undefined)
        const moduleRef = await Test.createTestingModule({
            providers: [SeedTestAccountsCli, { provide: TestAccountsSeedService, useValue: seed }],
        }).compile()

        await expect(moduleRef.get(SeedTestAccountsCli).run()).resolves.toBeUndefined()

        expect(seed.run.mock.calls).toEqual([['{"documents":[]}\n']])
    })
})
