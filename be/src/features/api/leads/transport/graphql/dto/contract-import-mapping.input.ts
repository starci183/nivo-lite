import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, MaxLength } from "class-validator"

@InputType()
/** Which column fills each contract field; an omitted or null field stays empty. */
export class ContractImportMappingInput {
    /** The customer name column. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    customerName?: string | null

    /** The plan column. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    plan?: string | null

    /** The first day column. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    startsOn?: string | null

    /** The last day column. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    endsOn?: string | null

    /** The amount column. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    amountVnd?: string | null

    /** The status column. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    status?: string | null

    /** The note column. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    note?: string | null
}
