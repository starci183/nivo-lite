import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** How far the setup of an installed agent got: the required gates confirmed on the newest draft, of all of them. */
export class SetupProgressType {
    /** The gates confirmed. */
    @Field(() => Int)
    confirmed!: number

    /** The gates the module requires. */
    @Field(() => Int)
    total!: number
}
