import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"

@ObjectType()
/** One installed agent of a workspace, with its agent and its active context version. */
export class ModuleInstallationType {
    /** The installation. */
    @Field(() => ID)
    id!: string

    /** The workspace. */
    @Field(() => ID)
    workspaceId!: string

    /** The module key. */
    @Field()
    moduleKey!: string

    /** The label of the instance. */
    @Field()
    name!: string

    /** True when the type allows several instances. */
    @Field()
    isMulti!: boolean

    /** The agent of the instance. */
    @Field(() => ID, { nullable: true })
    agentId?: string | null

    /** The display name of the agent. */
    @Field()
    agentName!: string

    /** The mention handle of the agent. */
    @Field()
    agentHandle!: string

    /** `installing`, `setup`, `ready`, `live` or `paused`. */
    @Field()
    status!: string

    /** `assist` or `autopilot`. */
    @Field()
    operatingMode!: string

    /** True when the agent acts on channels. */
    @Field()
    liveEnabled!: boolean

    /** The version in use; null before the first apply. */
    @Field(() => ID, { nullable: true })
    activeContextVersionId?: string | null

    /** The number of the version in use. */
    @Field(() => Int, { nullable: true })
    activeVersion?: number | null

    /** The settings of the instance (reply timeout, holding message). */
    @Field(() => GraphqlJsonObject)
    settings!: object

    /** When it was installed, ISO 8601. */
    @Field()
    createdAt!: string
}
