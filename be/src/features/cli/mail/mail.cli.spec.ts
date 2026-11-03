import { Test } from "@nestjs/testing"
import { MailCli } from "./mail.cli"

describe("MailCli", () => {
    it("shows the help of the group when no sub-command is named", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [MailCli] }).compile()
        const group = moduleRef.get(MailCli)
        const help = jest.fn()
        Object.defineProperty(group, "command", { value: { help } })

        await expect(Promise.resolve(group.run())).resolves.toBeUndefined()

        expect(help).toHaveBeenCalledTimes(1)
    })
})
