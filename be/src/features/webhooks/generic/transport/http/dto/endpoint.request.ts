import { IsUUID, MaxLength } from "class-validator"

/** The route parameter of the generic webhook: the connection that is the endpoint, which is also the scope of its signature proof. */
export class EndpointRequest {
    /** The connection id. */
    @IsUUID()
    @MaxLength(36)
    connectionId!: string
}
