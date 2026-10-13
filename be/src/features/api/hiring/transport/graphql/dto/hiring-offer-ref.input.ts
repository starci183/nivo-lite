import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names one offer of the caller's workspace. */
export class HiringOfferRefInput {
    /** The offer. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
