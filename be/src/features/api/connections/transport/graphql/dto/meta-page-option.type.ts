import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A Page waiting for the choice. */
export class MetaPageOptionType {
    /** The Page id. */
    @Field(() => ID)
    id!: string

    /** The Page name. */
    @Field(() => String)
    name!: string

    /** The Page category. */
    @Field(() => String)
    category!: string

    /** The linked Instagram account id. */
    @Field(() => String)
    igId!: string

    /** The linked Instagram username. */
    @Field(() => String)
    igUsername!: string
}
