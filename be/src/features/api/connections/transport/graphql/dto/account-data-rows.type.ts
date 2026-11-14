import { Field, Int, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"

@ObjectType()
/** One declared data type a connected account stores. */
export class AccountDataTypeType {
    /** The type's name. */
    @Field(() => String)
    type!: string

    /** The provider that writes it, or null for any provider. */
    @Field(() => String, { nullable: true })
    provider!: string | null

    /** The version of its fields. */
    @Field(() => Int)
    version!: number

    /** append, overwrite or advance. */
    @Field(() => String)
    write!: string

    /** The names of its members. */
    @Field(() => [String])
    fields!: Array<string>
}

@ObjectType()
/** One stored row of an account: the provider's data as it was sent. */
export class AccountDataRowType {
    /** The row. */
    @Field(() => String)
    id!: string

    /** The provider's own key of the row. */
    @Field(() => String)
    key!: string

    /** The version of the fields it was written with. */
    @Field(() => Int)
    typeVersion!: number

    /** When it happened, ISO. */
    @Field(() => String)
    occurredAt!: string

    /** The value. */
    @Field(() => GraphqlJsonObject)
    value!: object
}

@ObjectType()
/** The rows of one type of an account, or why none were read. */
export class AccountDataRowsType {
    /** type_unknown, type_not_of_account, or null. */
    @Field(() => String, { nullable: true })
    refusal!: string | null

    /** The rows, newest first. */
    @Field(() => [AccountDataRowType])
    rows!: Array<AccountDataRowType>
}
