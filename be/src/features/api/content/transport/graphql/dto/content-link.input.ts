import { Field, InputType } from "@nestjs/graphql"
import { IsUrl, MaxLength, IsString } from "class-validator"

@InputType()
/** A bounded content-link input. */
export class ContentLinkInput {
    /** The url field. */
    @Field()
    @IsUrl({ protocols: ["http", "https"], require_protocol: true })
    @MaxLength(2048)
    url!: string
    /** The label field. */
    @Field()
    @IsString()
    @MaxLength(80)
    label!: string
}
