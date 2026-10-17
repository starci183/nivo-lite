import { GraphQLScalarType } from "graphql"

/**
 * A map of text to text (the non-secret facts of a connection, the keys of a provider): it travels as one JSON object.
 */
export const StringMapScalar = new GraphQLScalarType({
    name: "StringMap",
    serialize: (value) => value,
    parseValue: (value) => value,
})
