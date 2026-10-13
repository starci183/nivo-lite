import { IsUUID, MaxLength } from "class-validator"

/** The path parameter that names one connection. */
export class ConnectionRequest {
    /** The Zalo OA connection. */
    @IsUUID()
    @MaxLength(36)
    connectionId!: string
}
