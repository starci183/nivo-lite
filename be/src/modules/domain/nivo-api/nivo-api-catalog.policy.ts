import { z } from "zod"
import { NIVO_API_GRAPHQL, type NivoApiVerb } from "@nivo-lite/agent-sdk/names"
import type { NivoApiDeclaration, NivoApiDeclarations, NivoApiOp, NivoApiRole } from "./nivo-api.contracts"

/** The JSON Schema of a validator as a plain object (draft 2020-12, what MCP defaults to). */
const jsonSchemaOf = (schema: z.ZodType, io: "input" | "output"): Readonly<Record<string, unknown>> => {
    const { $schema: _dialect, ...rest } = z.toJSONSchema(schema, { io, unrepresentable: "any" })
    return rest
}

/** True for the names of the declarations (the keys of a total table are exactly the declared names). */
const isDeclaredName = (declarations: NivoApiDeclarations, name: string): name is NivoApiVerb =>
    Object.prototype.hasOwnProperty.call(declarations, name)

/** Every declared name with its declaration, in declaration order. */
export const declaredOps = (
    declarations: NivoApiDeclarations,
): ReadonlyArray<{ readonly name: NivoApiVerb; readonly declaration: NivoApiDeclaration }> =>
    Object.keys(declarations)
        .filter((name) => isDeclaredName(declarations, name))
        .map((name) => ({ name, declaration: declarations[name] }))

/**
 * The catalogue the outbound MCP surface offers, generated from the declarations (never hand-listed): every op declared `exposed`, with
 * its GraphQL operation and the JSON Schemas of its input and output. An op declared `exposed: false` is not in it at all.
 */
export const buildNivoApiCatalog = (declarations: NivoApiDeclarations): ReadonlyArray<NivoApiOp> =>
    declaredOps(declarations).flatMap(({ name, declaration }) =>
        declaration.exposed
            ? [
                  {
                      name,
                      declaration,
                      graphql: NIVO_API_GRAPHQL[name],
                      inputSchema: jsonSchemaOf(declaration.input, "input"),
                      outputSchema: jsonSchemaOf(declaration.output, "output"),
                  },
              ]
            : [],
    )

/** The rank of each role: a holder passes an op whose role ranks at or below its own. */
const ROLE_RANK: Readonly<Record<NivoApiRole, number>> = { member: 0, manager: 1, owner: 2 }

/** The role a workspace seat's role stands for. */
export const roleOfSeat = (seatRole: string): NivoApiRole => {
    if (seatRole === "owner") return "owner"
    if (seatRole === "manager") return "manager"
    return "member"
}

/** True when a holder of `held` may run an op that requires `required`. */
export const holdsRole = (held: NivoApiRole, required: NivoApiRole): boolean => ROLE_RANK[held] >= ROLE_RANK[required]

/** The lower-case word tokens of a text: letters and digits, any other character separates (names split on `.` and `_` too). */
const tokensOf = (text: string): ReadonlyArray<string> =>
    text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((token) => token.length > 0)

/** One entry discovery searches: a declared name and its one-line summary. */
export interface SearchableOp {
    /** The full name. */
    readonly name: string
    /** The one-line summary. */
    readonly summary: string
}

/**
 * Retrieval for a client, not a decision: the entries in which every token of the query is a prefix of a token of the entry's name or
 * summary, those whose NAME holds more of the query's tokens first, then in catalogue order. An empty query matches every entry.
 */
export const searchOps = <T extends SearchableOp>(entries: ReadonlyArray<T>, query: string): ReadonlyArray<T> => {
    const wanted = tokensOf(query)
    const scored = entries.flatMap((entry, order) => {
        const nameTokens = tokensOf(entry.name)
        const allTokens = [...nameTokens, ...tokensOf(entry.summary)]
        if (!wanted.every((token) => allTokens.some((own) => own.startsWith(token)))) return []
        const inName = wanted.filter((token) => nameTokens.some((own) => own.startsWith(token))).length
        return [{ entry, inName, order }]
    })
    scored.sort((a, b) => b.inName - a.inName || a.order - b.order)
    return scored.map((scoredEntry) => scoredEntry.entry)
}
