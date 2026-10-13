import { InputType } from "@nestjs/graphql"
import { ImapConnectionInput } from "./imap-connection.input"

@InputType()
/** The bounded arguments of testImapConnection. */
export class TestImapConnectionInput extends ImapConnectionInput {}
