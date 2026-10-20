import { Type } from "class-transformer"
import { Field, ID, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from "class-validator"
import { AttachedFileInput } from "./attached-file.input"

@InputType()
/** One named brand color as edited on the card. */
export class BrandColorInput {
    /** The name. */
    @Field()
    @IsString()
    @MaxLength(40)
    name!: string

    /** The `#rrggbb` value. */
    @Field()
    @MaxLength(7)
    @Matches(/^#[0-9a-fA-F]{6}$/u)
    hex!: string
}

@InputType()
/** The brand kit as edited on the card. */
export class BrandKitInput {
    /** The brand name. */
    @Field()
    @IsString()
    @MaxLength(80)
    brandName!: string

    /** The palette. */
    @Field(() => [BrandColorInput])
    @ArrayMaxSize(6)
    @ValidateNested({ each: true })
    @Type(() => BrandColorInput)
    colors!: ReadonlyArray<BrandColorInput>

    /** The fonts. */
    @Field(() => [String])
    @ArrayMaxSize(4)
    @IsString({ each: true })
    @MaxLength(60, { each: true })
    fonts!: ReadonlyArray<string>

    /** The tone. */
    @Field()
    @IsString()
    @MaxLength(400)
    tone!: string

    /** How the brand addresses people. */
    @Field()
    @IsString()
    @MaxLength(200)
    address!: string

    /** The imagery. */
    @Field(() => [String])
    @ArrayMaxSize(5)
    @IsString({ each: true })
    @MaxLength(120, { each: true })
    imagery!: ReadonlyArray<string>

    /** What to avoid. */
    @Field(() => [String])
    @ArrayMaxSize(10)
    @IsString({ each: true })
    @MaxLength(120, { each: true })
    avoid!: ReadonlyArray<string>
}

@InputType()
/** A brand guideline PDF attached in the setup chat. */
export class ProposeBrandKitInput {
    /** The agent instance whose setup chat received it; empty for none. */
    @Field({ defaultValue: "" })
    @MaxLength(36)
    @Matches(/^([0-9a-f-]{36})?$/u)
    installationId!: string

    /** The open setup draft it joins; empty for none. */
    @Field({ defaultValue: "" })
    @MaxLength(36)
    @Matches(/^([0-9a-f-]{36})?$/u)
    setupSessionId!: string

    /** The file. */
    @Field(() => AttachedFileInput)
    @ValidateNested()
    @Type(() => AttachedFileInput)
    file!: AttachedFileInput
}

@InputType()
/** The agent instance whose brand proposals are listed. */
export class BrandProposalsInput {
    /** The instance. */
    @Field(() => ID)
    @MaxLength(36)
    @IsUUID("4")
    installationId!: string
}

@InputType()
/** The owner's decision on a brand proposal. */
export class DecideBrandProposalInput {
    /** The proposal. */
    @Field(() => ID)
    @MaxLength(36)
    @IsUUID("4")
    proposalId!: string

    /** confirm or reject. */
    @Field()
    @IsIn(["confirm", "reject"])
    decision!: "confirm" | "reject"

    /** The kit as edited; absent keeps the proposal. */
    @Field(() => BrandKitInput, { nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => BrandKitInput)
    kit?: BrandKitInput | null
}
