import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for the workbench read query. */
export class WorkbenchReadInput {
    /** The id of the read, `<module>.<name>`. */
    @Field()
    @IsString()
    @MaxLength(120)
    @Matches(/^[a-z][a-z0-9-]*\.[a-z][a-zA-Z0-9.-]*$/u)
    name!: string

    /** The variables of the read, as JSON text. */
    @Field()
    @IsString()
    @MaxLength(16_384)
    vars!: string
}
