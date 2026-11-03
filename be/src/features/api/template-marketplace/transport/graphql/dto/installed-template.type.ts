import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What installing a template made. */
export class InstalledTemplateType {
    /** The installation. */
    @Field(() => ID)
    installationId!: string

    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** The template key. */
    @Field(() => String)
    key!: string

    /** The version installed. */
    @Field(() => Int)
    version!: number

    /** The license record. */
    @Field(() => ID)
    licenseId!: string
}
