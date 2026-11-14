import { z } from "../../schema/zod-entry"
import { isNamespaced } from "../../schema/namespaced"
import type { ProviderKey, ToolId } from "../../names"
import type { JsonObject, JsonValue } from "../../schema/schema.types"
import { trusted } from "../../schema/trusted"
import type { Mode } from "../../graph/graph-spec-v2.types"
import type {
    DeclinedAnswer,
    DeclinedRefusal,
    Jsonable,
    TemplateNode,
    TemplateNodeConfig,
    ToolAnswer,
    ToolVia,
} from "./template-node.types"
import { type TemplateNodeProblemCode, type TemplateProblem, refuseProblems } from "./template-problems"

/** The settings schema of a node that declares none. */
export const NO_PARAMS: z.ZodObject<Record<string, never>> = z.object({})

/** What the definition checks read of a node: everything but the code. */
export interface TemplateNodeShape {
    /** The node's id. */
    readonly id: string
    /** Read as written (`{ vi, en }`, or absent), so an untyped config is judged too: `NODE_DESCRIPTION_MISSING`. */
    readonly description?: unknown
    /** The tools the node declares. */
    readonly tools: ReadonlyArray<ToolId>
    /** Read as written (a string, or absent), so an untyped config is judged too: `NODE_MODE_MISSING`, `NODE_MODE_INVALID`. */
    readonly mode?: string | undefined
    /** The providers whose accounts the node may use, as ordered alternatives. */
    readonly accounts: ReadonlyArray<ProviderKey>
    /** The schema of what the node is given. */
    readonly input: z.ZodType
    /** The schema of what the node returns. */
    readonly output: z.ZodType
    /** The schema of the node's settings; absent: it has none. */
    readonly params?: z.ZodType | undefined
    /** The tools an example must see called with an ok answer; absent: none. */
    readonly requires?: ReadonlyArray<ToolId> | undefined
    /** The output member that routes the node and the route names it takes; absent: the node does not route. */
    readonly routes?: { readonly by: string; readonly names: ReadonlyArray<string> } | undefined
    /** The node's examples, each named. */
    readonly examples: ReadonlyArray<{ readonly name: string }>
}

type Problem = TemplateProblem<TemplateNodeProblemCode>

/** The members of `list` that appear more than once, once each. */
export const duplicatesOf = <T>(list: ReadonlyArray<T>): ReadonlyArray<T> => [
    ...new Set(list.filter((value, index) => list.indexOf(value) !== index)),
]

/** The modes a node may declare (`nivo-frame.rights`): no other, and no engine default. */
const MODES: ReadonlyArray<string> = ["auto", "ask"] satisfies ReadonlyArray<Mode>

/**
 * The problem of a node's mode: none written (`NODE_MODE_MISSING`: also a compile error for a typed config), or a word that is neither
 * `auto` nor `ask` (`NODE_MODE_INVALID`).
 */
const modeProblems = (id: string, mode: string | undefined): ReadonlyArray<Problem> => {
    if (mode === undefined) return [{ code: "NODE_MODE_MISSING", at: `${id}.mode` }]
    return MODES.includes(mode) ? [] : [{ code: "NODE_MODE_INVALID", at: `${id}.mode` }]
}

/** Whether a declared text holds words in one language. */
const wordsIn = (value: unknown, locale: "vi" | "en"): boolean => {
    if (typeof value !== "object" || value === null) return false
    const text: unknown = Reflect.get(value, locale)
    return typeof text === "string" && text.trim() !== ""
}

/** The problem of a node's description: none, or one whose `vi` or `en` holds no words (nivo-frame `rights` rule 11e). */
const descriptionProblems = (id: string, description: unknown): ReadonlyArray<Problem> =>
    wordsIn(description, "vi") && wordsIn(description, "en") ? [] : [{ code: "NODE_DESCRIPTION_MISSING", at: `${id}.description` }]

/** The members of a node (or a graph step's node) the `ask` write check reads: its id, its tools and its mode. */
interface AskWritesNode {
    /** The node's id. */
    readonly id: string
    /** The tools the node declares. */
    readonly tools: ReadonlyArray<ToolId>
    /** The node's mode (`auto` or `ask`); absent: not `ask`. */
    readonly mode?: string | undefined
}

/**
 * The problem of a node (or a graph step) on `ask` that declares more than ONE write tool (nivo-frame `rights` rule 11e): one approval
 * card asks for one write. `writes` is the engine's knowledge of which tools write (`TemplateToolLookup.writes`, from the engine's tool
 * registry): the SDK cannot tell a read from a write at run time by itself, so a definition is judged here only when it is given.
 */
export const askWritesProblems = (
    node: AskWritesNode,
    writes: (tool: ToolId) => boolean,
    at: string = `${node.id}.tools`,
): ReadonlyArray<TemplateProblem<"NODE_ASK_WRITES_MANY">> => {
    if (node.mode !== "ask") return []
    const written = [...new Set(node.tools)].filter((tool) => writes(tool))
    return written.length > 1 ? [{ code: "NODE_ASK_WRITES_MANY", at, detail: written.join(", ") }] : []
}

/** The problems of a node's providers: one listed twice. */
const accountProblems = (id: string, accounts: ReadonlyArray<ProviderKey>): ReadonlyArray<Problem> =>
    duplicatesOf(accounts).map((provider): Problem => ({ code: "NODE_ACCOUNT_DUPLICATE", at: `${id}.accounts.${provider}` }))

/**
 * The options of a routing member of one output object: an enum's options, a text literal's values; null when the member is neither (any
 * text: the names are not checked against it).
 */
const memberOptionsOf = (schema: z.ZodObject, member: string): ReadonlyArray<string> | null => {
    const field: unknown = Reflect.get(schema.shape, member)
    if (field instanceof z.ZodEnum) return field.options.map(String)
    if (field instanceof z.ZodLiteral) {
        const values = [...field.values]
        return values.every((value): value is string => typeof value === "string") ? values : null
    }
    return null
}

/**
 * The objects an output may be: itself (an object), or each variant of a union (`z.union`, `z.discriminatedUnion`) of objects; null for
 * anything else.
 */
const outputObjectsOf = (output: z.ZodType): ReadonlyArray<z.ZodObject> | null => {
    if (output instanceof z.ZodObject) return [output]
    if (!(output instanceof z.ZodUnion)) return null
    const options: ReadonlyArray<unknown> = output.options
    return options.every((option): option is z.ZodObject => option instanceof z.ZodObject) ? options : null
}

/**
 * The route options of an output: an object's enum options; for a union, the routing member's options over every variant
 * (`memberOptionsOf`), or null when one says nothing (any text).
 */
const routeOptionsOf = (objects: ReadonlyArray<z.ZodObject>, member: string): ReadonlyArray<string> | null => {
    const [only, ...others] = objects
    // One object: only an enum is checked (as before unions were read); a literal there says one route and is left to the run.
    if (only !== undefined && others.length === 0) {
        const field: unknown = Reflect.get(only.shape, member)
        return field instanceof z.ZodEnum ? field.options.map(String) : null
    }
    const each = objects.map((object) => memberOptionsOf(object, member))
    return each.every((options): options is ReadonlyArray<string> => options !== null) ? [...new Set(each.flat())] : null
}

/**
 * The problems of a node's routes: `by` not a member of the output object (or of EVERY variant of a union output), names duplicated or
 * not the routing member's options (an enum's, or the literals the variants fix it to).
 */
const routeProblems = (node: TemplateNodeShape): ReadonlyArray<Problem> => {
    const routes = node.routes
    if (routes === undefined) return []
    const objects = outputObjectsOf(node.output)
    if (!objects?.every((object) => routes.by in object.shape)) {
        return [{ code: "NODE_ROUTES_BY_UNKNOWN", at: `${node.id}.routes.by` }]
    }
    const options = routeOptionsOf(objects, routes.by)
    const names: ReadonlyArray<string> = routes.names
    const sameAsEnum =
        options === null || (options.length === names.length && options.every((name) => names.includes(name)))
    return duplicatesOf(names).length > 0 || !sameAsEnum
        ? [{ code: "NODE_ROUTE_NAMES_INVALID", at: `${node.id}.routes.names` }]
        : []
}

/**
 * The definition problems of a template node, decided with no engine: a malformed id, a tool listed twice, a `requires` not in `tools`,
 * no description in both languages, no mode or one that is neither `auto` nor `ask`, a provider listed twice, an
 * input or params schema that is not an object, `routes.by` not a member of the output (or names that are not its enum's options), and no example (or two of one name).
 */
export const templateNodeProblems = (node: TemplateNodeShape): ReadonlyArray<Problem> => {
    const tools = new Set<string>(node.tools)
    const params = node.params ?? NO_PARAMS
    const examples: ReadonlyArray<{ readonly name: string }> = node.examples
    return [
        ...(isNamespaced(node.id) ? [] : [{ code: "NODE_ID_MALFORMED" as const, at: node.id }]),
        ...duplicatesOf(node.tools).map((tool): Problem => ({
            code: "NODE_TOOL_DUPLICATE",
            at: `${node.id}.tools.${tool}`,
        })),
        ...(node.requires ?? [])
            .filter((tool) => !tools.has(tool))
            .map((tool): Problem => ({ code: "NODE_TOOL_UNDECLARED", at: `${node.id}.requires.${tool}` })),
        ...descriptionProblems(node.id, node.description),
        ...modeProblems(node.id, node.mode),
        ...accountProblems(node.id, node.accounts),
        ...(node.input instanceof z.ZodObject
            ? []
            : [{ code: "NODE_SCHEMA_NOT_OBJECT" as const, at: `${node.id}.input` }]),
        ...(params instanceof z.ZodObject
            ? []
            : [{ code: "NODE_SCHEMA_NOT_OBJECT" as const, at: `${node.id}.params` }]),
        ...routeProblems(node),
        ...(examples.length === 0 ? [{ code: "NODE_EXAMPLES_EMPTY" as const, at: `${node.id}.examples` }] : []),
        ...duplicatesOf(examples.map((example) => example.name)).map((name): Problem => ({
            code: "NODE_EXAMPLE_NAME_DUPLICATE",
            at: `${node.id}.examples.${name}`,
        })),
    ]
}

/**
 * Defines a template node: a feature a package ships, run by the engine as a running node bound to a workspace's accounts. Throws
 * `TemplateDefinitionError` at module load with every problem of `templateNodeProblems`. Its examples are run by `checkTemplateNode`.
 */
export const defineTemplateNode = <
    I extends z.ZodType,
    O extends z.ZodType,
    P extends z.ZodType = z.ZodObject<Record<string, never>>,
    const R extends string = never,
>(
    config: TemplateNodeConfig<I, O, P, R>,
): TemplateNode<I, O, P, R> => {
    refuseProblems(config.id, templateNodeProblems(config))
    return { ...config, entry: "template-node" }
}

/** NIVO's own tools answer through no account. */
const NO_VIA: ToolVia = { provider: null, connectionId: null }

/** A scripted ok answer of a tool, through a provider when one is named: it carries no refusal, so it fits every tool's typed refusals. */
export const toolOk = <A>(
    value: A,
    provider: ProviderKey | null = null,
    connectionId: string | null = null,
): ToolAnswer<A, never> => ({
    ok: true,
    value,
    via: provider === null ? NO_VIA : { provider, connectionId: connectionId ?? `${provider}-1` },
})

/** The engine's code of a declined approval. */
const DECLINED: DeclinedRefusal = "declined"

/** A declined approval as a call answers it: `ToolDeclined` (the node's business `declined` branch), still carrying its wire code. */
export const toolDeclined = (facts: JsonObject = {}): DeclinedAnswer => ({ ok: false, declined: true, refusal: DECLINED, facts })

/**
 * An answer as a node reads it: the engine's declined code (`{ ok: false, refusal: "declined" }` on the wire) becomes `ToolDeclined`
 * (`declined: true`), so the node's `answer.declined` branch takes it; any other answer as it is.
 */
export const toolAnswerRead = <A>(answer: ToolAnswer<A> | DeclinedAnswer): ToolAnswer<A> | DeclinedAnswer =>
    !answer.ok && answer.declined !== true && answer.refusal === DECLINED ? toolDeclined(answer.facts) : answer

/** A scripted business refusal of a tool: its code is `R` (a literal where one is written), so it fits a tool's typed refusals. */
export const toolRefused = <A, R extends string = string>(refusal: R, facts: JsonObject = {}): ToolAnswer<A, R> => ({
    ok: false,
    refusal,
    facts,
})

/**
 * A value of a JSON shape as a `JsonValue`: what `agent.run`'s `input` (and an example's agent `answer`) takes, for a value typed by an
 * `interface` (which `JsonValue` refuses, having no index signature). `T & Jsonable<T>` proves every member JSON at compile time.
 */
export const asJson = <T>(value: T & Jsonable<T>): JsonValue => trusted<JsonValue>(value)
