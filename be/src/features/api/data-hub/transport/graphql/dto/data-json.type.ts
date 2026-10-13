import { GraphQLScalarType } from "graphql"

/** A JSON value (a saved configuration, a column mapping, a picked-table list): it travels as one JSON value; the capability that reads it cleans it. */
export const DataJsonScalar = new GraphQLScalarType({
    name: "DataJson",
    serialize: (value) => value,
    parseValue: (value) => value,
})
