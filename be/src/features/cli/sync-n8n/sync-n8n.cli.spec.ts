import { Test } from "@nestjs/testing"
import { SyncN8nCli } from "./sync-n8n.cli"

describe("SyncN8nCli", () => {
    it("shows the help of the group, and runs nothing else, when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [SyncN8nCli] }).compile()
        const group = moduleRef.get(SyncN8nCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(Promise.resolve(group.run())).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
