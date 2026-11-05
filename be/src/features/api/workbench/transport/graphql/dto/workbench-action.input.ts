import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for the workbench action mutation. */
export class WorkbenchActionInput {
    /** The id of the action, `<module>.<name>`. */
    @Field()
    @IsString()
    @MaxLength(120)
    @Matches(/^[a-z][a-z0-9-]*\.[a-z][a-zA-Z0-9.-]*$/u)
    name!: string

    /** The input of the action, as JSON text. */
    @Field()
    @IsString()
    @MaxLength(16_384)
    input!: string
}
