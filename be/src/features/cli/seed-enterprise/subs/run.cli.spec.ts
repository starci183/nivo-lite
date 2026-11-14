import { Readable } from "node:stream"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EnterpriseSeedService } from "@modules/domain/channel-provisioning"
import { EnterpriseRunCli } from "./run.cli"

describe("EnterpriseRunCli", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("hands the whole of stdin and the environment to the enterprise seed once", async () => {
        const chunks = Readable.from(['{"documents":', "[]}\n"])
        const stdin = mock<typeof process.stdin>({ [Symbol.asyncIterator]: () => chunks[Symbol.asyncIterator]() })
        jest.spyOn(process, "stdin", "get").mockReturnValue(stdin)
        const seed = mock<EnterpriseSeedService>()
        seed.run.mockResolvedValue(undefined)
        const moduleRef = await Test.createTestingModule({
            providers: [EnterpriseRunCli, { provide: EnterpriseSeedService, useValue: seed }],
        }).compile()
        const command = moduleRef.get(EnterpriseRunCli)

        await expect(command.run([], { env: command.parseEnv("dev") })).resolves.toBeUndefined()

        expect(seed.run.mock.calls).toEqual([['{"documents":[]}\n', "dev"]])
    })
})
