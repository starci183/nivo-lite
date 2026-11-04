import { Readable } from "node:stream"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ManagementSeedService } from "@modules/domain/channel-provisioning"
import { SeedManagementCli } from "./seed-management.cli"

describe("SeedManagementCli", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("hands the whole of stdin to the management seed once", async () => {
        const chunks = Readable.from(['{"documents":', "[]}\n"])
        const stdin = mock<typeof process.stdin>({ [Symbol.asyncIterator]: () => chunks[Symbol.asyncIterator]() })
        jest.spyOn(process, "stdin", "get").mockReturnValue(stdin)
        const seed = mock<ManagementSeedService>()
        seed.run.mockResolvedValue(undefined)
        const moduleRef = await Test.createTestingModule({
            providers: [SeedManagementCli, { provide: ManagementSeedService, useValue: seed }],
        }).compile()

        await expect(moduleRef.get(SeedManagementCli).run()).resolves.toBeUndefined()

        expect(seed.run.mock.calls).toEqual([['{"documents":[]}\n']])
    })
})
