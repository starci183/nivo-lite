import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of checkConnection. */
export class CheckConnectionInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string
}
