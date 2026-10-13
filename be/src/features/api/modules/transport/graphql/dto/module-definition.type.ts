import { Field, Int, ObjectType } from "@nestjs/graphql"
import { ModuleAcceptedCommandType } from "./module-accepted-command.type"
import { ModuleAgentType } from "./module-agent.type"
import { ModuleAuthorityActionType } from "./module-authority-action.type"
import { ModuleBilingualListType } from "./module-bilingual-list.type"
import { ModuleBilingualType } from "./module-bilingual.type"
import { ModuleGateType } from "./module-gate.type"
import { ModuleRequirementsType } from "./module-requirements.type"

@ObjectType()
/** One module of the catalogue: everything the product knows about an installable agent type. */
export class ModuleDefinitionType {
    /** The stable module key. */
    @Field()
    key!: string

    /** The display order in the catalogue. */
    @Field(() => Int)
    order!: number

    /** The full module name. */
    @Field(() => ModuleBilingualType)
    name!: ModuleBilingualType

    /** The short department name. */
    @Field(() => ModuleBilingualType)
    shortName!: ModuleBilingualType

    /** The catalogue description. */
    @Field(() => ModuleBilingualType)
    description!: ModuleBilingualType

    /** The selling points shown under the description. */
    @Field(() => ModuleBilingualListType)
    points!: ModuleBilingualListType

    /** One English line that tells the setup prompt what the module is for. */
    @Field()
    purpose!: string

    /** The name of the icon of the design system. */
    @Field()
    icon!: string

    /** The svg path of the module glyph. */
    @Field()
    glyph!: string

    /** The path of the module mascot image. */
    @Field()
    mascot!: string

    /** The key of the category the module belongs to. */
    @Field()
    category!: string

    /** `stable` or `early`. */
    @Field()
    status!: string

    /** `customer` or `internal`. */
    @Field()
    audience!: string

    /** The module comes with every workspace. */
    @Field()
    includedWithWorkspace!: boolean

    /** The module can be added from the catalogue. */
    @Field()
    available!: boolean

    /** The folder of the NIVO base knowledge for the module. */
    @Field()
    knowledgeFolder!: string

    /** The key of the workbench of the module, when it has one. */
    @Field(() => String, { nullable: true })
    workbench?: string | null

    /** The key of the extra settings of the module, when it has any. */
    @Field(() => String, { nullable: true })
    settingsExtras?: string | null

    /** What the workspace should have for the module. */
    @Field(() => ModuleRequirementsType)
    requires!: ModuleRequirementsType

    /** The connection providers the agent of the module can use. */
    @Field(() => [String])
    connectionProviders!: ReadonlyArray<string>

    /** How a new installation starts running. */
    @Field()
    defaultOperatingMode!: string

    /** A workspace may install several agents of this type. */
    @Field()
    multiInstance!: boolean

    /** The agent the module installs. */
    @Field(() => ModuleAgentType)
    agent!: ModuleAgentType

    /** What the module must know before it may act. */
    @Field(() => [ModuleGateType])
    gates!: ReadonlyArray<ModuleGateType>

    /** The actions the authority matrix governs. */
    @Field(() => [ModuleAuthorityActionType])
    authorityActions!: ReadonlyArray<ModuleAuthorityActionType>

    /** The commands other agents may ask the module to run. */
    @Field(() => [ModuleAcceptedCommandType])
    accepts!: ReadonlyArray<ModuleAcceptedCommandType>
}
