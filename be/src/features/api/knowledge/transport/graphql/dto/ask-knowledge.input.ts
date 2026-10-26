import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** The question to try and the agent it is asked as. */
export class AskKnowledgeInput {
    /** The question. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(600)
    question!: string

    /** The agent the question is asked as. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    module!: string

    /** `customer` sees public passages only; `internal` sees all. */
    @Field(() => String)
    @IsIn(["customer", "internal"])
    @MaxLength(40)
    audience!: string

    /** The agent instance the question is asked as: its own documents join the shared ones. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    installationId?: string | null
}
