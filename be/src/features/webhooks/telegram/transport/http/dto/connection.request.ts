import { IsUUID, MaxLength } from "class-validator"

/** The route parameter of the Telegram webhook: the connection the bot was registered with. */
export class ConnectionRequest {
    /** The connection id, which is also the scope of the secret-token proof. */
    @IsUUID()
    @MaxLength(36)
    connectionId!: string
}
