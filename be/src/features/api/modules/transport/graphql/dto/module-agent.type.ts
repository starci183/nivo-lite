import { Field, ObjectType } from "@nestjs/graphql"
import { ModuleBilingualListType } from "./module-bilingual-list.type"
import { ModuleBilingualType } from "./module-bilingual.type"

@ObjectType()
/** The agent a module installs with. */
export class ModuleAgentType {
    /** The role the default name of the agent carries ("Agent Chatbot #23233"), in both languages. */
    @Field(() => ModuleBilingualType)
    label!: ModuleBilingualType

    /** The mention handle of the agent. */
    @Field()
    handle!: string

    /** The one-line summary of the agent. */
    @Field(() => ModuleBilingualType)
    summary!: ModuleBilingualType

    /** What the agent can do. */
    @Field(() => ModuleBilingualListType)
    capabilities!: ModuleBilingualListType

    /** The default role text of the agent. */
    @Field(() => ModuleBilingualType)
    role!: ModuleBilingualType

    /** The default instructions of the agent. */
    @Field(() => ModuleBilingualType)
    instructions!: ModuleBilingualType
}
