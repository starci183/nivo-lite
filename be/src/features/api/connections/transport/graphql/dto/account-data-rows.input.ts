import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** What accountDataTypes takes. */
export class AccountDataTypesInput {
    /** The connected account. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    connectionId!: string
}

@InputType()
/** What accountDataRows takes. */
export class AccountDataRowsInput {
    /** The connected account. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    connectionId!: string

    /** The declared data type (`<provider>.<name>`). */
    @Field(() => String)
    @IsString()
    @MaxLength(50)
    type!: string

    /** How many rows, 1 to 100 (20 when absent). */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number | null
}
