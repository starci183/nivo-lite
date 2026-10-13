import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The copy-ready ads of a job. */
export class GenerateAdType {
    /** The Facebook group post. */
    @Field(() => String)
    facebook!: string

    /** The Zalo group message. */
    @Field(() => String)
    zalo!: string

    /** The job board post. */
    @Field(() => String)
    topcv!: string

    /** When it was written. */
    @Field(() => String)
    generatedAt!: string

    /** How long the model took. */
    @Field(() => Int)
    ms!: number

    /** Model calls made. */
    @Field(() => Int)
    attempts!: number

    /** Whether lines about protected traits were removed. */
    @Field(() => Boolean)
    sanitised!: boolean
}
