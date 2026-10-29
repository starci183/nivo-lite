import { Test } from "@nestjs/testing"
import { StorageCli } from "./storage.cli"

describe("StorageCli", () => {
    it("shows the help of the group when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [StorageCli] }).compile()
        const group = moduleRef.get(StorageCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(Promise.resolve(group.run())).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
