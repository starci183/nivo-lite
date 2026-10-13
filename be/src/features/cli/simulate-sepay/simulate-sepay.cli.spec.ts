import { Test } from "@nestjs/testing"
import { SimulateSepayCli } from "./simulate-sepay.cli"

describe("SimulateSepayCli", () => {
    it("shows the help of the group when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [SimulateSepayCli] }).compile()
        const group = moduleRef.get(SimulateSepayCli)
        const help = jest.fn().mockResolvedValue(undefined)
        Object.defineProperty(group, "command", { value: { help } })

        await expect(group.run()).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
        expect(help).toHaveBeenCalledWith()
    })
})
