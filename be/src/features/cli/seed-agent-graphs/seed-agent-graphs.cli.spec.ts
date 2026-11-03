import { Readable } from "node:stream"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphSeedService } from "@modules/domain/workspace-seed"
import { SeedAgentGraphsCli } from "./seed-agent-graphs.cli"

const build = async () => {
    jest.spyOn(process, "stdin", "get").mockReturnValue(
        Object.assign(Readable.from(['{"documents":', "[]}\n"]), { fd: 0 }) as unknown as typeof process.stdin,
    )
    const seed = mock<GraphSeedService>()
    seed.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [SeedAgentGraphsCli, { provide: GraphSeedService, useValue: seed }],
    }).compile()
    return { cli: moduleRef.get(SeedAgentGraphsCli), seed }
}

describe("SeedAgentGraphsCli", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("hands the whole of stdin and the named workspace to the graph seed once", async () => {
        const { cli, seed } = await build()

        await expect(cli.run([], { workspace: cli.parseWorkspace("NIVO") })).resolves.toBeUndefined()

        expect(seed.run.mock.calls).toEqual([['{"documents":[]}\n', "NIVO"]])
    })

    it("names no workspace when none was given, so the seed refuses it", async () => {
        const { cli, seed } = await build()

        await cli.run([], {})

        expect(seed.run.mock.calls).toEqual([['{"documents":[]}\n', ""]])
    })
})
