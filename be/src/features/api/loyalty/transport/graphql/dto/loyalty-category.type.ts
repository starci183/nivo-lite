import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** The loyalty category fields exposed through GraphQL. */
export class LoyaltyCategoryType {
    /** The match. */
    @Field(() => String)
    match!: string

    /** The per thousand vnd. */
    @Field(() => Float)
    perThousandVnd!: number

    /** The label. */
    @Field(() => String)
    label!: string
}
