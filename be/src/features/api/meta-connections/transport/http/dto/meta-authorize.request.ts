import { IsOptional, IsUUID } from "class-validator"

/** The bounded HTTP body of the MetaAuthorize operation. */
export class MetaAuthorizeBody {
    /** The connectionId sent by the caller. */
    @IsOptional()
    @IsUUID()
    connectionId?: string
}
