import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { OfficeSeedService } from "@modules/domain/workspace-seed"
import { OfficeSeedWorkspaceCli } from "./office.cli"

describe("OfficeSeedWorkspaceCli", () => {
    const build = async () => {
        const office = mock<OfficeSeedService>()
        const moduleRef = await Test.createTestingModule({
            providers: [OfficeSeedWorkspaceCli, { provide: OfficeSeedService, useValue: office }],
        }).compile()
        return { cli: moduleRef.get(OfficeSeedWorkspaceCli), office }
    }

    it("passes the owner and the execute flag", async () => {
        const { cli, office } = await build()

        await expect(cli.run([], { owner: "nam@example.test", execute: true })).resolves.toBeUndefined()

        expect(office.officeOperator).toHaveBeenCalledWith({ owner: "nam@example.test", execute: true })
    })

    it("hands an empty option set to the service, which treats it as a dry run", async () => {
        const { cli, office } = await build()

        await cli.run([], {})

        expect(office.officeOperator).toHaveBeenCalledWith({})
    })

    it("parses its options", async () => {
        const { cli } = await build()

        expect(cli.parseOwner("a@b.c")).toBe("a@b.c")
        expect(cli.parseExecute()).toBe(true)
    })
})
