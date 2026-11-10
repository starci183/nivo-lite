import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { BrainGraphOriginType } from "./brain-graph-origin.type"
import { BrainGraphPreviousType } from "./brain-graph-previous.type"

@ObjectType()
/** One node of the truth graph: one short truth with its source, version and validity. */
export class BrainGraphNodeType {
    /** The fact id. */
    @Field(() => ID)
    id!: string

    /** The subject key (nodes of one subject group together). */
    @Field(() => String)
    subjectKey!: string

    /** The subject. */
    @Field(() => String)
    subjectLabel!: string

    /** What the subject is. */
    @Field(() => String)
    subjectType!: string

    /** The attribute. */
    @Field(() => String)
    attributeLabel!: string

    /** The value. */
    @Field(() => String)
    value!: string

    /** The unit. */
    @Field(() => String, { nullable: true })
    unit!: string | null

    /** `active` or `scheduled`. */
    @Field(() => String)
    status!: string

    /** Which value of its key this is. */
    @Field(() => Int, { nullable: true })
    version!: number | null

    /** From when it holds. */
    @Field(() => String, { nullable: true })
    validFrom!: string | null

    /** Until when it holds (one year after it started unless stated). */
    @Field(() => String, { nullable: true })
    validTo!: string | null

    /** `public`, `internal` or `restricted`. */
    @Field(() => String)
    scope!: string

    /** The modules that read a restricted truth. */
    @Field(() => [String])
    modules!: ReadonlyArray<string>

    /** The agent instance it is kept for, or null for every instance. */
    @Field(() => ID, { nullable: true })
    installationId!: string | null

    /** Where it comes from. */
    @Field(() => BrainGraphOriginType)
    origin!: BrainGraphOriginType

    /** The value it replaced. */
    @Field(() => BrainGraphPreviousType, { nullable: true })
    previous!: BrainGraphPreviousType | null

    /** When it was put in force. */
    @Field(() => String, { nullable: true })
    changedAt!: string | null

    /** Put in force in the last seven days (the orange node). */
    @Field(() => Boolean)
    recentlyChanged!: boolean

    /** How many change requests wait for its key. */
    @Field(() => Int)
    pendingCount!: number

    /** A truth of another subject shown because an edge of the page reaches it. */
    @Field(() => Boolean)
    neighbor!: boolean
}
