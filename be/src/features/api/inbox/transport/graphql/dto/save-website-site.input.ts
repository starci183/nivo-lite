import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** What the owner changes on the website intake; a field left out keeps its value. */
export class SaveWebsiteSiteInput {
    /** Switch the intake on or off. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    isEnabled?: boolean

    /** The site shows the chat button. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    chatEnabled?: boolean

    /** The site shows the order form. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    formEnabled?: boolean

    /** The site shows the price list. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    pricesEnabled?: boolean

    /** The agent that receives the customers; an explicit null clears it. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    agentId?: string | null
}
