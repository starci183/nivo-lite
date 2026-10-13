import { Field, ObjectType } from "@nestjs/graphql"
import { ModuleBilingualType } from "./module-bilingual.type"

@ObjectType()
/** One command a module accepts from other agents. */
export class ModuleAcceptedCommandType {
    /** The stable command key. */
    @Field()
    command!: string

    /** The authority action that governs the command. */
    @Field()
    action!: string

    /** The kind of subject the command acts on. */
    @Field()
    subjectType!: string

    /** The payload keys a sender must supply. */
    @Field(() => [String])
    requiredFields!: ReadonlyArray<string>

    /** What the command does. */
    @Field(() => ModuleBilingualType)
    description!: ModuleBilingualType
}
