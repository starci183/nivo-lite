import { Field, ID, InputType } from "@nestjs/graphql"
import { Transform } from "class-transformer"
import type { TransformFnParams } from "class-transformer"
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** Names the dashboard of one module agent. */
export class AgentDashboardInput {
    /** The module whose dashboard it is. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    module!: string

    /** The instance whose dashboard it is; the first of the module when absent. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @IsUUID("4")
    @MaxLength(36)
    installationId?: string
}
