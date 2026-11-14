import { Test } from "@nestjs/testing"
import { AgentsCli } from "./agents.cli"

describe("AgentsCli", () => {
    it("shows the group help when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [AgentsCli] }).compile()
        const group = moduleRef.get(AgentsCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(Promise.resolve(group.run())).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
