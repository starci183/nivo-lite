import { Command, CommandRunner } from "nest-commander"
import { OutboxMailCli } from "./subs/outbox.cli"

@Command({
    name: "mail",
    description: "The platform mail: the development outbox of held messages",
    subCommands: [OutboxMailCli],
})
/** `cli mail`: the mail group; its commands are the sub-commands (`cli mail outbox`). */
export class MailCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
