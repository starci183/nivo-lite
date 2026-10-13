import { GraphQLScalarType, Kind } from "graphql"
import type { ValueNode } from "graphql"

const isPlainObject = (value: unknown): value is object =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const literalOf = (node: ValueNode): unknown => {
    if (node.kind === Kind.OBJECT) {
        return Object.fromEntries(node.fields.map((field) => [field.name.value, literalOf(field.value)]))
    }
    if (node.kind === Kind.LIST) return node.values.map(literalOf)
    if (node.kind === Kind.INT || node.kind === Kind.FLOAT) return Number(node.value)
    if (node.kind === Kind.STRING || node.kind === Kind.ENUM || node.kind === Kind.BOOLEAN) return node.value
    return null
}

/** A free-form JSON object whose keys the owning operation defines (settings by key, the data of an event, a command payload). Anything that is not an object is refused by the schema. */
export const GraphqlJsonObject = new GraphQLScalarType<object | undefined, object>({
    name: "JsonObject",
    serialize: (value) => (isPlainObject(value) ? value : {}),
    parseValue: (value) => (isPlainObject(value) ? value : undefined),
    parseLiteral: (node) => {
        const value = literalOf(node)
        return isPlainObject(value) ? value : undefined
    },
})
