import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One named brand color. */
export class BrandColorType {
    /** The name the guideline gives it. */
    @Field()
    name!: string

    /** The `#rrggbb` value. */
    @Field()
    hex!: string
}

@ObjectType()
/** The brand kit read from a guideline. */
export class BrandKitType {
    /** The brand name. */
    @Field()
    brandName!: string

    /** The palette, primary first. */
    @Field(() => [BrandColorType])
    colors!: ReadonlyArray<BrandColorType>

    /** The font families, heading first. */
    @Field(() => [String])
    fonts!: ReadonlyArray<string>

    /** The tone of voice. */
    @Field()
    tone!: string

    /** How the brand addresses itself and the customer. */
    @Field()
    address!: string

    /** The imagery the guideline asks for. */
    @Field(() => [String])
    imagery!: ReadonlyArray<string>

    /** What to avoid. */
    @Field(() => [String])
    avoid!: ReadonlyArray<string>
}

@ObjectType()
/** A brand kit waiting for (or past) the owner's confirmation. */
export class BrandProposalType {
    /** The proposal. */
    @Field(() => ID)
    id!: string

    /** The agent instance whose setup chat received the file. */
    @Field(() => ID, { nullable: true })
    installationId!: string | null

    /** The setup draft the file was attached to. */
    @Field(() => ID, { nullable: true })
    setupSessionId!: string | null

    /** The file name. */
    @Field()
    fileName!: string

    /** The file size, bytes. */
    @Field(() => Int)
    fileSize!: number

    /** The kit. */
    @Field(() => BrandKitType)
    kit!: BrandKitType

    /** proposed, applied or rejected. */
    @Field()
    status!: string

    /** Who decided it. */
    @Field(() => String, { nullable: true })
    decidedBy!: string | null

    /** When it was read, ISO 8601. */
    @Field()
    createdAt!: string
}
