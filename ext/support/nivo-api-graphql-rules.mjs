// What the project check `nivo-api-graphql` (ext/checks/nivo-api-graphql.mjs) decides, as pure functions over plain data, so its spec runs on
// fixtures. This file is no check: it lives in ext/support/ because the harness's R103 refuses a file of ext/checks/ that the manifest does
// not declare. Concept: .starciwork/concepts/tools.md (each `nivo.api.nivo.*` op maps 1:1 to one GraphQL operation).
import { Kind, parse } from "graphql"

/** The kind of root a GraphQL definition sits on, by the name of its object type. */
const ROOT_KIND = { Query: "query", Mutation: "mutation" }

/**
 * The fields of the contract's roots: `{ query: Set<field>, mutation: Set<field> }`, read from the SDL by the GraphQL parser (`type` and
 * `extend type` definitions both).
 */
export const rootFieldsOf = (sdl) => {
    const fields = { query: new Set(), mutation: new Set() }
    for (const definition of parse(sdl).definitions) {
        if (definition.kind !== Kind.OBJECT_TYPE_DEFINITION && definition.kind !== Kind.OBJECT_TYPE_EXTENSION) continue
        const kind = ROOT_KIND[definition.name.value]
        if (kind === undefined) continue
        for (const field of definition.fields ?? []) fields[kind].add(field.name.value)
    }
    return fields
}

/**
 * The API names a text claims (`nivo.api.nivo.<segments>`): a name token, read by its shape (dot-joined lower-case segments). A token that
 * is followed by `.*` or `.{` names a family (`nivo.api.nivo.contact.*`), not one operation, and is no claim.
 */
export const claimedApiNames = (text) => [
    ...new Set(
        [...text.matchAll(/nivo\.api\.nivo\.[a-z]+(?:\.[a-z]+)*/gu)]
            .filter((match) => !/^\.[*{]/u.test(text.slice(match.index + match[0].length, match.index + match[0].length + 2)))
            .map((match) => match[0]),
    ),
]

/**
 * The findings (strings) of one comparison.
 *   names: the declared `API.nivo.*` values; table: `{ [api name]: { kind, operation } }`; roots: `rootFieldsOf(sdl)`;
 *   claims: `{ [source label]: text }` (the resolvers and the SDL), every API name a text claims must be declared.
 */
export const findingsOf = ({ names, table, roots, claims }) => {
    const found = []
    const declared = new Set(names)
    for (const name of names) {
        const row = table[name]
        if (row === undefined) {
            found.push(`${name}: no row in NIVO_API_GRAPHQL (names/nivo-api-graphql.ts)`)
            continue
        }
        if (row.kind !== "query" && row.kind !== "mutation") {
            found.push(`${name}: row kind \`${String(row.kind)}\` is neither query nor mutation`)
            continue
        }
        if (!roots[row.kind].has(row.operation)) {
            const other = row.kind === "query" ? "mutation" : "query"
            found.push(
                roots[other].has(row.operation)
                    ? `${name}: \`${row.operation}\` is a ${other} of the contract, the row says ${row.kind}`
                    : `${name}: the contract has no ${row.kind} \`${row.operation}\``,
            )
        }
    }
    for (const name of Object.keys(table)) {
        if (!declared.has(name)) found.push(`${name}: a row of NIVO_API_GRAPHQL for an API name that is not declared`)
    }
    const byOperation = new Map()
    for (const name of names) {
        const row = table[name]
        if (row === undefined) continue
        const key = `${String(row.kind)} ${row.operation}`
        byOperation.set(key, [...(byOperation.get(key) ?? []), name])
    }
    for (const [key, served] of byOperation) {
        if (served.length > 1) found.push(`${key}: served by ${served.length} API names (${served.join(", ")}); the mapping is 1:1`)
    }
    for (const [source, text] of Object.entries(claims)) {
        for (const claimed of claimedApiNames(text)) {
            if (!declared.has(claimed)) found.push(`${source}: claims \`${claimed}\`, which is no declared API name`)
        }
    }
    return found
}
