import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Selects one Chatbot installation or every Chatbot in the workspace. */
export class ChatbotOverviewInput {
    /** The installation id, omitted to combine the workspace's Chatbot agents. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    installationId?: string | null
}
