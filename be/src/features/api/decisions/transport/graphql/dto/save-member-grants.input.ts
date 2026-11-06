import { Field, Float, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from "class-validator"

@InputType()
/** The approval limit of one member. */
export class MemberGrantChangeInput {
    /** The member. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    memberId!: string

    /** The largest amount the member may approve (inclusive); null means no limit. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1000000000000)
    maxAmount: number | null = null
}

@InputType()
/** Makes the approval limits of one action exactly the ones named. */
export class SaveMemberGrantsInput {
    /** The action key. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(80)
    action!: string

    /** The members that may approve it, each with a limit; a member not named loses theirs. */
    @Field(() => [MemberGrantChangeInput])
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => MemberGrantChangeInput)
    grants!: Array<MemberGrantChangeInput>
}
