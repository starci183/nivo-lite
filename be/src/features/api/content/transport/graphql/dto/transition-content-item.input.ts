import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, IsIn, MaxLength } from "class-validator"

@InputType()
/** A lifecycle transition checked by the capability. */
export class TransitionContentItemInput {
    /** The id field. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
    /** The kind field. */
    @Field()
    @IsIn(["skip", "restore", "reopen", "delete"])
    @MaxLength(16)
    kind!: string
}
