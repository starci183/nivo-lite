import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** One ability as a person wants it on an attachment. */
export class AbilityWishInput {
    /** The ability id. */
    @Field(() => String)
    @IsString()
    @MaxLength(41)
    @Matches(/^[a-z][a-z0-9.-]{1,40}$/u)
    id!: string

    /** off (not ticked), auto or ask. */
    @Field(() => String)
    @IsIn(["off", "auto", "ask"])
    mode!: "off" | "auto" | "ask"
}
