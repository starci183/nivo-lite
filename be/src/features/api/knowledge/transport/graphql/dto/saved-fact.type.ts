import { Field, ObjectType } from "@nestjs/graphql"
import { BrainFactType } from "./brain-fact.type"

@ObjectType()
/** A fact the owner or manager wrote, and what happened to it. */
export class SavedFactType {
    /** What happened: a new fact, the same value again, a conflict or a supersede. */
    @Field(() => String)
    outcome!: string

    /** The fact as stored. */
    @Field(() => BrainFactType)
    fact!: BrainFactType
}
