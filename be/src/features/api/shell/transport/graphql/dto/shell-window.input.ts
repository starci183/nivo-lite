import { Field, InputType } from "@nestjs/graphql"
import { IsISO8601, MaxLength } from "class-validator"

@InputType()
/** The Founding window the shell evaluates membership against. */
export class ShellWindowInput {
    /** Start of the window, ISO 8601. */
    @Field()
    @IsISO8601()
    @MaxLength(40)
    foundingFrom!: string

    /** End of the window, ISO 8601. */
    @Field()
    @IsISO8601()
    @MaxLength(40)
    foundingTo!: string
}
