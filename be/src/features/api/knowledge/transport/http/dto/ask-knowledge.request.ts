import { IsString, MaxLength } from "class-validator"

/** The bounded HTTP request that asks what an agent would retrieve for a question. */
export class AskKnowledgeRequest {
    /** The question. */
    @IsString()
    @MaxLength(2000)
    question!: string

    /** The agent the question is asked as. */
    @IsString()
    @MaxLength(60)
    module!: string

    /** customer sees public passages only. */
    @IsString()
    @MaxLength(20)
    audience!: string
}
