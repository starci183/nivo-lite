import type { ImapInput } from "@modules/domain/data-hub"
import type { ImapConnectionInput } from "./dto/imap-connection.input"

/** Maps the shared mailbox arguments to the domain input; the domain checks and cleans every field. */
export const toImapInput = (input: ImapConnectionInput): ImapInput => ({ ...input })
