import { CommandRunner, Option, SubCommand } from "nest-commander"
import { InjectMailOutbox } from "@modules/integrations/mail"
import type { MailOutboxService } from "@modules/integrations/mail"

/** What the operator typed. */
export interface OutboxMailRequest {
    /** Only the messages to this address. */
    readonly to?: string | undefined
    /** Only the newest message. */
    readonly latest?: boolean | undefined
}

@SubCommand({
    name: "outbox",
    description:
        "Print the messages the suppress list held back in the development outbox (MAIL_OUTBOX_DIR), with their links. Prints nothing in production.",
})
/** `cli mail outbox [--to <address>] [--latest]`: reads the confirmation or reset link of a test sign-up. */
export class OutboxMailCli extends CommandRunner {
    constructor(@InjectMailOutbox() private readonly outbox: MailOutboxService) {
        super()
    }

    /** Prints the asked messages. */
    run(_passedParams: Array<string>, options: OutboxMailRequest = {}): Promise<void> {
        return this.outbox.report(options, process.stdout)
    }

    /** The recipient to look for. */
    @Option({ flags: "--to <address>", description: "Only the messages to this address" })
    takeTo(value: string): string {
        return value
    }

    /** Keeps the newest message. */
    @Option({ flags: "--latest", description: "Only the newest message" })
    takeLatest(): boolean {
        return true
    }
}
