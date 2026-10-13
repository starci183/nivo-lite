import { Test } from "@nestjs/testing"
import { SeedModulesCli } from "./seed-modules.cli"

describe("SeedModulesCli", () => {
    it("shows the help of the group, and runs nothing else, when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [SeedModulesCli] }).compile()
        const group = moduleRef.get(SeedModulesCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(Promise.resolve(group.run())).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
