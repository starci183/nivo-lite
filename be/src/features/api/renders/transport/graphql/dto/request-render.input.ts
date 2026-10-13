import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The project whose render is queued. */
export class RequestVideoRenderInput {
    /** The video project to render. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    projectId!: string
}
