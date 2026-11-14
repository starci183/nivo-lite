import { Field, ObjectType } from "@nestjs/graphql"
import { ModuleBilingualType } from "./module-bilingual.type"

@ObjectType()
/**
 * The plugin a module belongs to: the core package or a plugin package. The agents catalogue shows an agent as
 * `<plugin label>-<agent name>` (the plugin "Nivo" and the agent "Accounting" read "Nivo-Accounting"), composed by the client from this label and the module's own name.
 */
export class ModulePluginType {
    /** The stable key of the plugin. */
    @Field()
    key!: string

    /** The short display label of the plugin, in both languages. */
    @Field(() => ModuleBilingualType)
    label!: ModuleBilingualType
}
