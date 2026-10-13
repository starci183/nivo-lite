import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** The key of the value to keep. */
export class KeepCurrentBrainFactInput {
    /** The normalised subject. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    subjectKey!: string

    /** The normalised attribute. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    attribute!: string

    /** The agent instance the key is scoped to; omitted = every instance. */
    @Field(() => ID, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    installationId?: string
}
