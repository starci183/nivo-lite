import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What needs the owner in the Second Brain: the counts the rail, the tab and the page header show. */
export class BrainTodoType {
    /** Findings still open or confirmed. */
    @Field(() => Int)
    findings!: number

    /** Cards of facts waiting for a decision; 0 for a member who is not an owner or manager. */
    @Field(() => Int)
    facts!: number

    /** Customer questions nobody has answered; 0 for a member who is not an owner or manager. */
    @Field(() => Int)
    questions!: number

    /** Answers NIVO found in the internal documents that wait for the owner to publish; 0 for a member who is not an owner or manager. */
    @Field(() => Int)
    proposals!: number

    /** Facts, questions and proposals: the one inbox number of what needs doing (findings stay with their dossiers). */
    @Field(() => Int)
    total!: number
}
