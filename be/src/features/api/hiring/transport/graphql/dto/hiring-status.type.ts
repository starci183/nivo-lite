import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a status change answers. */
export class HiringStatusType {
    /** The status now. */
    @Field(() => String)
    status!: string
}
