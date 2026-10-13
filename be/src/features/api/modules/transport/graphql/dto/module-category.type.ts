import { Field, ObjectType } from "@nestjs/graphql"
import { ModuleBilingualType } from "./module-bilingual.type"

@ObjectType()
/** One category the catalogue groups modules by. */
export class ModuleCategoryType {
    /** The stable category key. */
    @Field()
    key!: string

    /** The category title. */
    @Field(() => ModuleBilingualType)
    label!: ModuleBilingualType
}
