import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The CV link of a candidate. */
export class HiringCvType {
    /** The short-lived link. */
    @Field(() => String)
    url!: string

    /** The file name. */
    @Field(() => String)
    name!: string

    /** The media type. */
    @Field(() => String)
    mime!: string
}
