import { Field, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Identifies the asynchronous lead action to inspect. */
export class LeadActionStatusInput {
    /** The queued lead action identifier. */
    @Field()
    @IsUUID()
    @MaxLength(36)
    id!: string
}
