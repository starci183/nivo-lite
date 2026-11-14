import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** What a visitor sends through the hosted form of a shop website. The form needs a phone, an email or a message; the rest says where it came from. */
export class SubmitWebsiteLeadInput {
    /** The public key in the address of the hosted form. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9]{12,40}$/)
    @MaxLength(40)
    siteKey!: string

    /** The name of the visitor. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name: string | null = null

    /** The phone of the visitor. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    phone: string | null = null

    /** The email of the visitor. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    email: string | null = null

    /** What the visitor wrote. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    message: string | null = null

    /** The path of the page the form sat on. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    pagePath: string | null = null

    /** The campaign the visit came from. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    campaign: string | null = null

    /** The device kind the browser reported. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    device: string | null = null

    /** An id the page keeps for the visitor, so one person is grouped without a phone. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    visitor: string | null = null

    /** An id of this submission; a form sent twice with it is one input. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    submissionId: string | null = null
}
