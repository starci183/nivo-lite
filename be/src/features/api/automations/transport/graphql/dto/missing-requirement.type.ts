import { Field, ObjectType } from "@nestjs/graphql"
import { LocalizedTextType } from "./localized-text.type"

@ObjectType()
/** Why a template cannot be switched on yet. */
export class MissingRequirementType {
    /** `module`, `channel`, `connection` or `capability`. */
    @Field()
    kind!: string

    /** The key of the missing thing. */
    @Field()
    key!: string

    /** The label of the missing thing. */
    @Field(() => LocalizedTextType)
    label!: LocalizedTextType
}
