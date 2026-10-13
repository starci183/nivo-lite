import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** ContentAutomationMark returned by content settings operations. */
export class ContentAutomationMarkType {
    /** key. */
    @Field()
    key!: string

    /** value. */
    @Field()
    value!: string
}
