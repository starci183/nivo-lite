import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The queued render whose status is polled. */
export class VideoRenderStatusInput {
    /** The render id returned when work was queued. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
