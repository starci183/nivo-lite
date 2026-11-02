import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A piece of the internal text NIVO left out of a draft. */
export class PublicLeftOutType {
    /** A short label of the piece: its first words, with long numbers masked. */
    @Field(() => String)
    label!: string

    /** Why: `salary`, `id_number`, `contract`, `capital` or `internal_discount`. */
    @Field(() => String)
    reason!: string
}
