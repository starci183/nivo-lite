import { IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request of request-render: the project to render. */
export class RequestRenderRequest {
    /** The video project to render. */
    @IsUUID("4")
    @MaxLength(36)
    projectId!: string
}
