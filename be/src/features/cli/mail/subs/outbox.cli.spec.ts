import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { MAIL_OUTBOX } from "@modules/integrations/mail"
import type { MailOutboxService } from "@modules/integrations/mail"
import { OutboxMailCli } from "./outbox.cli"

const build = async () => {
    const outbox = mock<MailOutboxService>()
    const moduleRef = await Test.createTestingModule({
        providers: [OutboxMailCli, { provide: MAIL_OUTBOX, useValue: outbox }],
    }).compile()
    return { command: moduleRef.get(OutboxMailCli), outbox }
}

describe("OutboxMailCli", () => {
    it("prints the asked messages to the terminal", async () => {
        const { command, outbox } = await build()

        await command.run([], { to: "a@x.test", latest: true })

        expect(outbox.report).toHaveBeenCalledWith({ to: "a@x.test", latest: true }, process.stdout)
    })
    it("prints everything with no option at all", async () => {
        const { command, outbox } = await build()

        await command.run([])

        expect(outbox.report).toHaveBeenCalledWith({}, process.stdout)
    })
    it("answers the value of its flags", async () => {
        const { command } = await build()

        expect(command.takeTo("a@x.test")).toBe("a@x.test")
        expect(command.takeLatest()).toBe(true)
    })
})
