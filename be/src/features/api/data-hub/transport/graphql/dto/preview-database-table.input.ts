import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsDefined, IsOptional, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { DataJsonScalar } from "../data-json.mapper"
import { DatabaseTargetInput } from "./database-target.input"

@InputType()
/** The bounded arguments of previewDatabaseTable. */
export class PreviewDatabaseTableInput {
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

    /**
     * One table mapping: schema, table, entity, idColumn, titleColumn, updatedColumn, columns (cleaned by the back
     * end).
     */
    @Field(() => DataJsonScalar)
    @IsDefined()
    mapping!: unknown
}
