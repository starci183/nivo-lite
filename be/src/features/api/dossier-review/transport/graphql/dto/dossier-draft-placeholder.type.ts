import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A value a draft leaves for the owner to fill in. */
export class DossierDraftPlaceholderType {
    /** What to fill in. */
    @Field(() => String)
    label!: string

    /** Why NIVO could not. */
    @Field(() => String)
    reason!: string
}
