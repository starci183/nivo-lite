import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The document whose checked facts are applied together. */
export class ApplyBrainFactGroupInput {
    /** The document. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    sourceId!: string
}
