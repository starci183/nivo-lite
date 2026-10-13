import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What moving a candidate to another stage answers. */
export class MoveCandidateType {
    /** The stage now. */
    @Field()
    stage!: string
}
