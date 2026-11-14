import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What the founder's answer on a document changed. */
export class KnowledgeSourceNatureAnswerType {
    /** The document. */
    @Field(() => ID)
    id!: string

    /** How many readings of its parts went back to triage (a running one takes the answer at its own next triage). */
    @Field(() => Int)
    reopened!: number
}
