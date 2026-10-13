import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that set the shop up from the quick import text. */
export class ApplyShiftsImportInput {
    /** The positions, one per line or separated by commas. */
    @Field(() => String)
    @IsString()
    @MaxLength(20000)
    positions!: string

    /** The people, one per line. */
    @Field(() => String)
    @IsString()
    @MaxLength(50000)
    staff!: string

    /** The coverage, one per line. */
    @Field(() => String)
    @IsString()
    @MaxLength(50000)
    coverage!: string
}
