import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsString, MaxLength } from "class-validator"

@InputType()
/** One earlier turn of a guide conversation. */
export class GuideTurnInput {
    /** Who said it. */
    @Field()
    @IsIn(["user", "guide"])
    role!: "user" | "guide"

    /** What was said. */
    @Field()
    @IsString()
    @MaxLength(2000)
    text!: string
}
