import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What the packager kept and what it left out, counted. */
export class PackageReportType {
    /** Nodes kept. */
    @Field(() => Int)
    nodes!: number

    /** Branches kept. */
    @Field(() => Int)
    branches!: number

    /** References to the internal Brain removed. */
    @Field(() => Int)
    brainRefs!: number

    /** Customer chats, learned proposals and people removed from sources. */
    @Field(() => Int)
    privateSources!: number

    /** Members and rooms removed from approvers. */
    @Field(() => Int)
    people!: number

}
