import { Test } from "@nestjs/testing"
import { PruneWorkspacesCli } from "./prune-workspaces.cli"

describe("PruneWorkspacesCli", () => {
    it("shows the help of the group, and runs nothing else, when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [PruneWorkspacesCli] }).compile()
        const group = moduleRef.get(PruneWorkspacesCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(Promise.resolve(group.run())).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
