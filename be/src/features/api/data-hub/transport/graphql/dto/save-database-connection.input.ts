import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsDefined, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { DataJsonScalar } from "./data-json.scalar"
import { DatabaseTargetInput } from "./database-target.input"

@InputType()
/** The bounded arguments of saveDatabaseConnection. */
export class SaveDatabaseConnectionInput {
    /** The connection to update; absent creates a new one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(64)
    connectionId?: string | null

    /** The name the owner gives the connection. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    name!: string

    /** How to reach the database. */
    @Field(() => DatabaseTargetInput)
    @ValidateNested()
    @Type(() => DatabaseTargetInput)
    target!: DatabaseTargetInput

    /** The mapped tables: a list of {schema, table, entity, idColumn, titleColumn, updatedColumn, columns} (cleaned by the back end). */
    @Field(() => DataJsonScalar)
    @IsDefined()
    tables!: unknown

    /** Minutes between scheduled syncs: 15, 60, 360 or 1440; null is manual only. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsIn([15, 60, 360, 1440])
    everyMinutes?: number | null
}
