import { Field, ObjectType } from "@nestjs/graphql"
import { DataJsonScalar } from "../data-json.mapper"

@ObjectType()
/** The authentication a spec hints at. */
export class OpenApiAuthHintType {
    /** none, header, query, bearer or basic. */
    @Field(() => String)
    type!: string

    /** The header or query parameter name, when the type has one. */
    @Field(() => String)
    name!: string
}

@ObjectType()
/** An API spec read from a link or text, with its operations. */
export class OpenApiSpecType {
    /** The API title. */
    @Field(() => String)
    title!: string

    /** The base URL the spec names (may be empty). */
    @Field(() => String)
    baseUrl!: string

    /** The link the spec was read from (empty for pasted text). */
    @Field(() => String)
    specUrl!: string

    /**
     * The operations: a list of {id, method, path, summary, params: [{name, in, required}], hasBody, suggest?:
     * {itemsPath, idField, titleField}}.
     */
    @Field(() => DataJsonScalar)
    ops!: unknown

    /** The authentication the spec hints at. */
    @Field(() => OpenApiAuthHintType)
    authHint!: OpenApiAuthHintType
}
