import { Field, InputType, ID, Int } from "@nestjs/graphql"
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** Bounded arguments for save booking resource. */
export class SaveBookingResourceInput {
    /** The id. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    id?: string | null

    /** The name. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string

    /** The kind. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    kind!: string

    /** The capacity. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(200)
    capacity!: number

    /** The active. */
    @Field(() => Boolean)
    @IsBoolean()
    active!: boolean

    /** The staff id. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    staffId?: string | null
}
