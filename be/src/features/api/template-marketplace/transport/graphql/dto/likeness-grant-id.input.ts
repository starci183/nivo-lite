import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Which consent record. */
export class LikenessGrantIdInput {
    /** The record. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    grantId!: string
}
