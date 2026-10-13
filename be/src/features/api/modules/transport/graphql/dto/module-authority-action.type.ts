import { Field, Float, ObjectType } from "@nestjs/graphql"
import { ModuleBilingualType } from "./module-bilingual.type"

@ObjectType()
/** One action of a module that the authority matrix governs. */
export class ModuleAuthorityActionType {
    /** The stable action key. */
    @Field()
    action!: string

    /** The action title. */
    @Field(() => ModuleBilingualType)
    label!: ModuleBilingualType

    /** The default authority mode. */
    @Field()
    mode!: string

    /** The default amount limit in VND, when one applies. */
    @Field(() => Float, { nullable: true })
    limitVnd?: number | null

    /** The fields a request for this action must carry. */
    @Field(() => [String])
    requiredFields!: ReadonlyArray<string>

    /** Whether an amount limit is meaningful for the action. */
    @Field()
    amountLimit!: boolean

    /** The loosest mode the action can ever take. */
    @Field(() => String, { nullable: true })
    maxMode?: string | null

    /** A note shown with the action. */
    @Field()
    note!: string

    /** The actions this one chains to. */
    @Field(() => [String])
    next!: ReadonlyArray<string>
}
