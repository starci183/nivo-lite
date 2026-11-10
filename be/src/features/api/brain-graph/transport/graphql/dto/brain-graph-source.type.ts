import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { BrainGraphReadingType } from "./brain-graph-reading.type"

@ObjectType()
/** One document the graph was built from ("Tai lieu nguon"). */
export class BrainGraphSourceType {
    /** The knowledge source. */
    @Field(() => ID)
    sourceId!: string

    /** Its title. */
    @Field(() => String)
    title!: string

    /** How many truths in force it supports ("14 nut"). */
    @Field(() => Int)
    nodeCount!: number

    /** When the newest of them was put in force ("cap nhat 08/11"). */
    @Field(() => String, { nullable: true })
    lastChangedAt!: string | null

    /** How far its reading got, or null when it was never read. */
    @Field(() => BrainGraphReadingType, { nullable: true })
    reading!: BrainGraphReadingType | null
}
