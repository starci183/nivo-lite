import { Field, Int, InputType } from "@nestjs/graphql"
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded arguments that change the hiring settings. */
export class SaveHiringSettingsInput {
    /** The new public slug. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    publicSlug?: string

    /** Days a rejected or withdrawn candidate is kept. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(3650)
    retentionDays?: number

    /** Whether a new candidate is announced in the Office. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    notifyNewCandidate?: boolean

    /** Whether confirmed interviews are reminded. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    remindInterview?: boolean

    /** Whether a job closes once enough people accepted. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    autoCloseWhenFilled?: boolean

    /** The consent text an applicant agrees to. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    applyConsentText?: string

    /** The tone of generated ads. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    adTone?: string
}
