import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Whether Google can be used on this deployment. */
export class GoogleStateType {
    /** True when Google is set up. */
    @Field(() => Boolean)
    configured!: boolean
}
