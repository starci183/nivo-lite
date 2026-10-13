import { Test } from "@nestjs/testing"
import { SeedMediaCli } from "./seed-media.cli"

describe("SeedMediaCli", () => {
    it("shows the help of the group, and runs nothing else, when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [SeedMediaCli] }).compile()
        const group = moduleRef.get(SeedMediaCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(Promise.resolve(group.run())).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
