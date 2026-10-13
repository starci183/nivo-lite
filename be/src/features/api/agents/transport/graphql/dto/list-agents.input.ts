import { Field, InputType } from "@nestjs/graphql"
import { Transform } from "class-transformer"
import type { TransformFnParams } from "class-transformer"
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded arguments that list the agents of the workspace. */
export class ListAgentsInput {
    /** Only the agents of this module. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    module?: string
}
