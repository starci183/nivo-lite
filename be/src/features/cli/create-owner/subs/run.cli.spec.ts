import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OwnersService } from "@modules/domain/owners"
import { RunCreateOwnerCli } from "./run.cli"

const build = async () => {
    const owners = mock<OwnersService>()
    owners.createOwner.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [RunCreateOwnerCli, { provide: OwnersService, useValue: owners }],
    }).compile()
    return { command: moduleRef.get(RunCreateOwnerCli), owners }
}

describe("RunCreateOwnerCli", () => {
    it("hands the address and password to the owner bootstrap", async () => {
        const { command, owners } = await build()

        await expect(
            command.run([], { email: "owner@example.test", password: "a-long-password" }),
        ).resolves.toBeUndefined()

        expect(owners.createOwner).toHaveBeenCalledWith("owner@example.test", "a-long-password")
    })

    it("returns the value of its flags", async () => {
        const { command } = await build()

        expect(command.takeEmail("a@b.test")).toBe("a@b.test")
        expect(command.takePassword("pw")).toBe("pw")
    })
})
