import { Field, ObjectType } from "@nestjs/graphql"
import { ApiKeyType } from "./api-key.type"

@ObjectType()
/** A key just created: the secret is in this answer only. */
export class CreatedApiKeyType {
    /** The secret key, shown once. */
    @Field()
    key!: string

    /** The stored view of the key. */
    @Field(() => ApiKeyType)
    item!: ApiKeyType
}
