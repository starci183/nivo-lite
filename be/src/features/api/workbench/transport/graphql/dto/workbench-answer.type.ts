import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What the workbench door answers: the data of a read, or the result of an action, as JSON text. */
export class WorkbenchAnswerType {
    /** The JSON text. */
    @Field()
    data!: string
}
