import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The command a slow request started. */
export class BrainCommandRefType {
    /** The command to follow. */
    @Field(() => ID)
    id!: string
}
