import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of checkMeta. */
export class CheckMetaInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** Make the subscriptions again first. */
    @Field(() => Boolean)
    @IsBoolean()
    repair!: boolean
}
