import { Readable } from "node:stream"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EnterpriseSeedService } from "@modules/domain/channel-provisioning"
import { EnterpriseRemoveCli } from "./remove.cli"

describe("EnterpriseRemoveCli", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("hands stdin, the environment and the execute choice to the enterprise seed once", async () => {
        const chunks = Readable.from(['{"schema":', '"nivo/enterprise-seed@1"}'])
        const stdin = mock<typeof process.stdin>({ [Symbol.asyncIterator]: () => chunks[Symbol.asyncIterator]() })
        jest.spyOn(process, "stdin", "get").mockReturnValue(stdin)
        const seed = mock<EnterpriseSeedService>()
        seed.remove.mockResolvedValue(undefined)
        const moduleRef = await Test.createTestingModule({
            providers: [EnterpriseRemoveCli, { provide: EnterpriseSeedService, useValue: seed }],
        }).compile()
        const command = moduleRef.get(EnterpriseRemoveCli)

        await expect(
            command.run([], { env: command.parseEnv("dev"), execute: command.parseExecute() }),
        ).resolves.toBeUndefined()

        expect(seed.remove.mock.calls).toEqual([['{"schema":"nivo/enterprise-seed@1"}', "dev", true]])
    })
})
