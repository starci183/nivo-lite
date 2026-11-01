import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The batch to take back. */
export class UndoBrainFactBatchInput {
    /** The batch an apply-together answered. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    batchId!: string
}
