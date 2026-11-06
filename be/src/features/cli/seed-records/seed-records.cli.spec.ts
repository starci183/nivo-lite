import { Readable } from "node:stream"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { RecordsSeedService } from "@modules/domain/channel-provisioning"
import { SeedRecordsCli } from "./seed-records.cli"

const build = async () => {
    const chunks = Readable.from(['{"documents":', "[]}\n"])
    const stdin = mock<typeof process.stdin>({ [Symbol.asyncIterator]: () => chunks[Symbol.asyncIterator]() })
    jest.spyOn(process, "stdin", "get").mockReturnValue(stdin)
    const seed = mock<RecordsSeedService>()
    seed.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [SeedRecordsCli, { provide: RecordsSeedService, useValue: seed }],
    }).compile()
    return { cli: moduleRef.get(SeedRecordsCli), seed }
}

describe("SeedRecordsCli", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("hands the whole of stdin and the named workspace to the records seed once", async () => {
        const { cli, seed } = await build()

        await expect(cli.run([], { workspace: cli.parseWorkspace("NIVO") })).resolves.toBeUndefined()

        expect(seed.run.mock.calls).toEqual([['{"documents":[]}\n', "NIVO"]])
    })

    it("names no workspace when none was given, so the seed refuses it", async () => {
        const { cli, seed } = await build()

        await cli.run([], { workspace: "" })

        expect(seed.run.mock.calls).toEqual([['{"documents":[]}\n', ""]])
    })
})
