import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A starter set a business can pick: key, name and what it brings. */
export class InventoryTemplateType {
    /** The template key. */
    @Field(() => String)
    key!: string

    /** The template name. */
    @Field(() => String)
    name!: string

    /** What it brings. */
    @Field(() => String)
    description!: string
}
