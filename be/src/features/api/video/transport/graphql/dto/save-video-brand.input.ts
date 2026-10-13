import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** Bounded saveVideoBrand arguments. */
export class SaveVideoBrandInput {
    /** shopName input. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    shopName!: string

    /** primary input. */
    @Field(() => String)
    @Matches(/^#[0-9a-fA-F]{6}$/u)
    @MaxLength(7)
    primary!: string

    /** secondary input. */
    @Field(() => String)
    @Matches(/^#[0-9a-fA-F]{6}$/u)
    @MaxLength(7)
    secondary!: string

    /** logoPath input. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    logoPath!: string | null

    /** musicTrack input. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["sunny-pop", "calm-glow", "bold-beat"])
    @MaxLength(60)
    musicTrack!: string | null

    /** voice input. */
    @Field(() => String)
    @IsIn(["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"])
    @MaxLength(80)
    voice!: string
}
