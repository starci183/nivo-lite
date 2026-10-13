import { IsUUID, MaxLength } from "class-validator"

/** The route parameter of the Zalo webhook: the connection the OA was registered with. */
export class ConnectionRequest {
    /** The connection id, which is also the scope of the mac proof. */
    @IsUUID()
    @MaxLength(36)
    connectionId!: string
}
