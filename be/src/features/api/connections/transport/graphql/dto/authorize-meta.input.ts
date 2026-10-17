import { NullAsAbsent } from "@modules/platform/graphql"
import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of authorizeMeta. */
export class AuthorizeMetaInput {
    /** The connection to log in again, or nothing for a new one. */
    @Field(() => ID, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsUUID()
    @MaxLength(64)
    connectionId?: string
}
