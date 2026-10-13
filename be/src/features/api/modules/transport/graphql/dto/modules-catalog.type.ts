import { Field, ObjectType } from "@nestjs/graphql"
import { ModuleCategoryType } from "./module-category.type"
import { ModuleDefinitionType } from "./module-definition.type"

@ObjectType()
/** The whole catalogue as the front end reads it. */
export class ModulesCatalogType {
    /** The categories, in display order. */
    @Field(() => [ModuleCategoryType])
    categories!: ReadonlyArray<ModuleCategoryType>

    /** The modules, in display order. */
    @Field(() => [ModuleDefinitionType])
    modules!: ReadonlyArray<ModuleDefinitionType>
}
