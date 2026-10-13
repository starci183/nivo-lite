import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The identity of a document that was just written. */
export class SourceRefType {
    /** The document id. */
    @Field(() => ID)
    id!: string
}
