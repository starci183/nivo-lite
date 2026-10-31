import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One string parameter of a rule finding message. */
export class DossierFindingParamType {
    /** The parameter name. */
    @Field(() => String)
    name!: string

    /** Its value. */
    @Field(() => String)
    value!: string
}
