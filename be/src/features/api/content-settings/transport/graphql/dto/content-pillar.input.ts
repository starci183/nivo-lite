import { Field, ID, InputType, Int } from "@nestjs/graphql"
import {
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    MinLength,
    Matches,
} from "class-validator"

@InputType()
/** One edited theme; an omitted id creates a new theme. */
export class ContentPillarInput {
    /** A retained theme id in the selected workspace. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    id?: string

    /** The nonblank theme name. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    @Matches(/\S/)
    name!: string

    /** The short writing guidance. */
    @Field()
    @IsString()
    @MaxLength(300)
    description!: string

    /** The desired balance across themes. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(20)
    weight!: number

    /** Whether this theme is used for planning. */
    @Field()
    @IsBoolean()
    active!: boolean
}
