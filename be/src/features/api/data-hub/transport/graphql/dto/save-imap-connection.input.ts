import { InputType } from "@nestjs/graphql"
import { ImapConnectionInput } from "./imap-connection.input"

@InputType()
/** The bounded arguments of saveImapConnection. */
export class SaveImapConnectionInput extends ImapConnectionInput {}
