import { IsUUID, MaxLength } from "class-validator"

/** The route parameter of the sandbox door of the Meta webhook: the sandbox connection the delivery is for. */
export class SandboxConnectionRequest {
    /** The sandbox connection id, which is also the scope of the sandbox key proof. */
    @IsUUID()
    @MaxLength(36)
    connectionId!: string
}
