import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What installing a module answers. */
export class ModuleInstallResultType {
    /** The installation. */
    @Field(() => ID)
    installationId!: string

    /** The agent of the instance. */
    @Field(() => ID, { nullable: true })
    agentId?: string | null

    /** False when the module was installed already and the call only answered it. */
    @Field()
    created!: boolean
}
