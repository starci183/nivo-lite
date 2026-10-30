import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded arguments that create a free workspace. */
export class CreateWorkspaceInput {
    /** The name of the new workspace. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string

    /** The business type named at onboarding: a known key or the owner's own words. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    businessType?: string | null
}
