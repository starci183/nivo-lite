import { Field, ID, InputType } from "@nestjs/graphql"
import { IsObject, IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import { GraphqlJsonObject } from "@modules/platform/graphql"

@InputType()
/** What runWorkflow takes. */
export class RunWorkflowInput {
    /** The installation whose agent holds the workflow. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    installationId!: string

    /** The workflow. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workflowId!: string

    /** The inputs, as the workflow's declared contract takes them (runnableWorkflow answers its JSON Schema). */
    @Field(() => GraphqlJsonObject)
    @IsObject()
    inputs!: Readonly<Record<string, unknown>>

    /** One stable key per intended start, reused on its retries: the same key starts the workflow once. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    opKey!: string
}
