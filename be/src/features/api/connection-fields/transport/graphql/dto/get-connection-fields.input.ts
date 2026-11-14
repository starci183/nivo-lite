import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of connectionFields. */
export class GetConnectionFieldsInput {
    /** The connected account. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string
}
