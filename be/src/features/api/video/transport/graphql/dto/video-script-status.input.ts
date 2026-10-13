import { InputType, Field } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The operation whose progress is polled. */
export class VideoScriptStatusInput {
    /** Stable request UUID. */
    @Field()
    @IsUUID()
    @MaxLength(36)
    id!: string
}
