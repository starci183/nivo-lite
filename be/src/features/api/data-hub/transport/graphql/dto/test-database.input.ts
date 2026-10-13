import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsOptional, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { DatabaseTargetInput } from "./database-target.input"

@InputType()
/** The bounded arguments of testDatabase. */
export class TestDatabaseInput {
    /** The saved connection whose stored password may be reused. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(64)
    connectionId?: string | null

    /** How to reach the database. */
    @Field(() => DatabaseTargetInput)
    @ValidateNested()
    @Type(() => DatabaseTargetInput)
    target!: DatabaseTargetInput
}
