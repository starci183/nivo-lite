import { IsUUID, Matches, MaxLength, MinLength } from "class-validator"

/** The route parameters of the render door: the compose provider, the connection (the scope of the proof) and the path's token. */
export class RenderDoorRequest {
    /** The provider key, as `connections.provider` names it. */
    @Matches(/^[a-z0-9_]{1,40}$/u)
    provider!: string

    /** The connection id. */
    @IsUUID()
    @MaxLength(36)
    connectionId!: string

    /** The connection's own webhook secret, as the callback NIVO handed the provider carries it. */
    @MinLength(1)
    @MaxLength(256)
    token!: string
}
