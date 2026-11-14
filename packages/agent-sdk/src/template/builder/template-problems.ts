import { DomainError } from "@starci/common"
import type { FailReason } from "./template-node.types"
import type { JsonObject } from "../../schema/schema.types"

/** Why a template node is refused at definition. */
export type TemplateNodeProblemCode =
    /** The id is not `<module>.<feature>`. */
    | "NODE_ID_MALFORMED"
    /** A tool listed twice. */
    | "NODE_TOOL_DUPLICATE"
    /** A `requires` entry that is not in `tools`. */
    | "NODE_TOOL_UNDECLARED"
    /** No description, or one whose `vi` or `en` holds no words: every node says what it does in both languages. */
    | "NODE_DESCRIPTION_MISSING"
    /** No mode: every node declares `auto` or `ask` (`nivo-frame.rights`); there is no engine default. */
    | "NODE_MODE_MISSING"
    /** A mode that is neither `auto` nor `ask`. */
    | "NODE_MODE_INVALID"
    /** One provider listed twice in a node's (or a step's) `accounts`. */
    | "NODE_ACCOUNT_DUPLICATE"
    /** The input or params schema is not an object: a graph binds them by member. */
    | "NODE_SCHEMA_NOT_OBJECT"
    /** `routes.by` is not a member of the output object. */
    | "NODE_ROUTES_BY_UNKNOWN"
    /** A route name listed twice, or, when the `by` member is an enum, names that are not exactly its options. */
    | "NODE_ROUTE_NAMES_INVALID"
    /** No example. */
    | "NODE_EXAMPLES_EMPTY"
    /** Two examples with the same name. */
    | "NODE_EXAMPLE_NAME_DUPLICATE"

/** Why a template graph is refused at save. Each is decided without the engine unless its doc says otherwise. */
export type TemplateGraphProblemCode =
    | TemplateNodeProblemCode
    /**
     * Engine-decided (`TemplateToolLookup.writes`): a step on `ask` whose node declares more than one write tool; one approval card asks
     * for one write (nivo-frame `rights` rule 11e).
     */
    | "NODE_ASK_WRITES_MANY"
    /** A step whose template node is not in the index. */
    | "NODE_UNKNOWN"
    /** Engine-decided (`TemplateToolLookup.known`): a tool the engine's registry has no spec for. */
    | "TOOL_UNKNOWN"
    /** Engine-decided (`TemplateToolLookup.owns`): a provider of the step with an adapter for none of the node's tools. */
    | "NODE_ACCOUNT_PROVIDER_NOT_OWNER"
    /** A step provider that is not in the agent template's `accounts`. */
    | "NODE_ACCOUNT_NOT_OF_AGENT"
    /** A step provider its node does not list: a step may only narrow or reorder the node's providers (its mode it may set either way). */
    | "GRAPH_ACCOUNT_WIDER"
    /** A route name of the node without a target, or a target for a name the node does not declare. */
    | "GRAPH_ROUTE_UNTARGETED"
    /** Two steps with one key. */
    | "GRAPH_NODE_DUPLICATE"
    /** A `next` or route to a key the graph (or the body) does not have. */
    | "GRAPH_TARGET_UNKNOWN"
    /** A step the run never reaches from the first one. */
    | "GRAPH_NODE_UNREACHABLE"
    /** The steps go round: the graph as written is acyclic; the one way round is a `loop`, whose cycle the engine draws. */

    | "GRAPH_CYCLE"
    /** A ref to a step that is not upstream (or, from outside a body, into it), or `item.*` outside a body. */
    | "GRAPH_REF_NOT_UPSTREAM"
    /** A ref to a step that may not have run (it does not dominate), with no `default`. */
    | "GRAPH_REF_NOT_DOMINATOR"
    /** A ref to a member the source does not declare, or whose type the target cannot take; or a malformed ref. */
    | "GRAPH_REF_TYPE"
    /** A required input member of the node that nothing binds. */
    | "GRAPH_INPUT_UNBOUND"
    /** A fixed value the node's schema refuses. */
    | "GRAPH_PARAM_INVALID"
    /** A graph input member whose type cannot be one of the contract types. */
    | "GRAPH_INPUT_UNTYPED"
    /** An outcome output whose type cannot be told from its value or ref. */
    | "GRAPH_OUTCOME_UNTYPED"
    /** An outcome name outside the stored outcome-key grammar (`^[a-z][a-z0-9-]{0,63}$`). */
    | "GRAPH_OUTCOME_NAME_INVALID"
    /** Two outcome steps of one name filling different outputs. */
    | "GRAPH_OUTCOME_MISMATCH"
    /** A `call-workflow` or an `outcome` inside a loop body. */
    | "LOOP_BODY_HANDOFF"
    /** A loop inside another one's body. */
    | "LOOP_NESTED"
    /** An `over` loop's `collect` that is not a node step of its body. */
    | "LOOP_COLLECT_UNKNOWN"
    /** A body step whose edge leaves the body (its own loop included), or a body step a step outside the body leads to. */
    | "LOOP_BODY_LEAK"
    /** A loop `max` that is not a whole number from 1 to 50 (`over`) or from 1 to 10 (`until`). */
    | "LOOP_MAX_INVALID"
    /** An `over` loop's `concurrency` that is not a whole number from 1 to 5. */
    | "LOOP_CONCURRENCY_INVALID"
    /** An `over` loop's item key that is neither a dotted field path of identifiers (`id`, `order.id`) nor `"."` (the item itself). */
    | "LOOP_KEY_INVALID"
    /** An `over` loop keyed by the item itself (`"."`) over a list whose items are typed as something else than a string or a number. */
    | "LOOP_KEY_NOT_SCALAR"
    /** An `until` route that names no routing node of the body, or a `stop` that is not one of its route names. */
    | "LOOP_UNTIL_ROUTE_UNKNOWN"
    /** An `until` loop with no `exhausted` route. */
    | "LOOP_EXHAUSTED_MISSING"
    /** An `until` loop with no `next`. */
    | "LOOP_NEXT_MISSING"
    /** An `until` loop's `every` that is not one unit of whole minutes 1–1440, hours 1–720 or days 1–30. */
    | "LOOP_EVERY_INVALID"
    | "WAIT_TRIGGERS_EMPTY"
    | "WAIT_TRIGGERS_TOO_MANY"
    | "WAIT_KEY_DUPLICATE"
    | "WAIT_KEY_INVALID"
    | "WAIT_ROUTE_MISSING"
    | "WAIT_ROUTE_UNKNOWN"
    | "WAIT_TIMEOUT_INVALID"
    | "WAIT_TRIGGER_UNSERVED"
    /** An expression deeper than 4 (a leaf is 1). */
    | "EXPR_TOO_DEEP"
    /** An expression of more than 16 leaves. */
    | "EXPR_TOO_LARGE"
    /** An order comparison not between two numbers or two ISO instants, or an equality between kinds that never meet. */
    | "EXPR_TYPE_MISMATCH"
    /** A value inside the graph's config that is not data: a function, a class instance, a symbol, a bigint, an `undefined` in a list. */
    | "GRAPH_VALUE_NOT_DATA"
    /** `endItem` / `endRound` named outside a loop body (it ends an item or a round, and there is none). */
    | "GRAPH_END_ITEM_OUTSIDE"
    /** A catalogue entry whose version is not a whole number from 1 or whose `publishedAt` is not an ISO 8601 instant. */
    | "GRAPH_CATALOGUE_INVALID"
    /** Given the engine's trigger lookup: a trigger of the array that does not supply a required input of the graph. */
    | "TRIGGER_INPUT_MISSING"
    /** Given the engine's trigger lookup: an input a trigger supplies with another type. */
    | "TRIGGER_INPUT_TYPE"
    /** A trigger provider that is not in the agent template's `accounts`. */
    | "TRIGGER_PROVIDER_NOT_OF_AGENT"
    /** A trigger listing one provider twice in its `accounts`. */
    | "TRIGGER_ACCOUNT_DUPLICATE"
    /** A graph naming one trigger verb (purpose) twice: each purpose is declared at most once (owner key `triggerOneSource2026_11_12`). */
    | "TRIGGER_PURPOSE_DUPLICATE"
    /**
     * Engine-decided (`TemplateTriggerLookup.supplies`): a graph woken by a person on an account (a verb that supplies `routeId`) hands the
     * person to another workflow with a `callWorkflow` that has a `next`: the run would stay open across that work and every later
     * event of the person would wait behind it. A hand-off of such a graph ENDS the run (owner's final rule 6).
     */
    | "GRAPH_HANDOFF_NOT_LAST"
    /**
     * A `handBack` with no event to hand back: the step it names is no `wait`, is in another round (another loop body, or outside it),
     * does not run before it on every road, or the hand-back is reached from the wait's `timeout` route (no event came) (R11).
     */
    | "GRAPH_HAND_BACK_NO_EVENT"
    /** A ref `{ round: "previous" }` outside an `until` body, to a step of another body, or without the `default` round 1 reads (R13). */
    | "GRAPH_REF_ROUND_INVALID"
    /** Engine-decided (`TemplateTriggerLookup.carriedBy`): a provider-backed verb with no `accounts`. */
    | "TRIGGER_ACCOUNT_MISSING"
    /** Engine-decided (`TemplateTriggerLookup.carriedBy`): a verb of the engine's own road given `accounts`. */
    | "TRIGGER_ACCOUNT_NOT_EXPECTED"
    /** Engine-decided (`TemplateTriggerLookup`): a verb the engine's registry has no spec for. */
    | "TRIGGER_UNKNOWN"
    /** The graph's key is not `<module>.<workflow>`. */
    | "GRAPH_KEY_MALFORMED"
    /** The `start` key is not a top-level step. */
    | "GRAPH_START_UNKNOWN"

/** Why a template agent is refused. */
export type TemplateAgentProblemCode =
    | TemplateGraphProblemCode
    /** `primary` names no graph of the agent. */
    | "AGENT_PRIMARY_UNKNOWN"
    /** Two graphs with one key. */
    | "AGENT_GRAPH_DUPLICATE"
    /** A provider listed twice. */
    | "AGENT_ACCOUNT_DUPLICATE"
    /** A graph whose module (the part of its key before the dot) is not the agent's key. */
    | "AGENT_GRAPH_OUTSIDE"
    /**
     * One trigger verb on several graphs of the agent without each keying it by one exact condition (`equals` / `in`) on one common param
     * with disjoint values (`sharedVerbProblems`): one wake starts one workflow per agent, so the pick would be arbitrary.
     */
    | "TRIGGER_VERB_SHARED"

/** One problem and where it is (a dotted path: `<node id>.accounts.<provider>`, `nodes.<key>.params.<member>`, `triggers.0`). */
export interface TemplateProblem<C extends string = TemplateAgentProblemCode> {
    /** The stable code of the problem. */
    readonly code: C
    /** Where the problem sits, as a dotted path. */
    readonly at: string
    /** What the place does not say, when a check names more (`TRIGGER_VERB_SHARED`: the verb, the graphs, why). */
    readonly detail?: string | undefined
}

/** A problem as one text: `<code>@<at>`, then its detail in brackets when it has one. */
const problemText = (problem: TemplateProblem<string>): string => {
    const detail = problem.detail === undefined ? "" : ` (${problem.detail})`
    return `${problem.code}@${problem.at}${detail}`
}

/** Thrown at module load by `defineTemplateNode`, `defineTemplateGraph` and `defineTemplateAgent`, naming every problem. */
export class TemplateDefinitionError extends DomainError<"TEMPLATE_DEFINITION_INVALID"> {
    /** Every problem of the definition. */
    readonly problems: ReadonlyArray<TemplateProblem>

    constructor(at: string, problems: ReadonlyArray<TemplateProblem>) {
        // `params.at`: the definition and every problem of it, as one text (`<key> (<code>@<at>, ...)`).
        super({ code: "TEMPLATE_DEFINITION_INVALID", params: { at: `${at} (${problems.map((problem) => problemText(problem)).join(", ")})` } })
        this.problems = problems
    }
}

/** Throws `TemplateDefinitionError` when there is any problem. */
export const refuseProblems = (at: string, problems: ReadonlyArray<TemplateProblem>): void => {
    if (problems.length > 0) throw new TemplateDefinitionError(at, problems)
}

/**
 * What `ctx.fail` throws, and what `agent.run` throws when the model is confused: the node ends without its output. The engine records the
 * reason and reports to /chat; a re-run after a person's answer runs the node again, whole.
 */
export class NodeFailedError extends DomainError<"NODE_FAILED"> {
    /** Why. */
    readonly reason: FailReason
    /** The facts the node adds. */
    readonly facts: JsonObject

    constructor(reason: FailReason, facts: JsonObject = {}) {
        super({ code: "NODE_FAILED", params: { at: reason.kind === "confused" ? (reason.question ?? "confused") : reason.why } })
        this.reason = reason
        this.facts = facts
    }
}

/** Whether a thrown value is a node's failure. */
export const isNodeFailed = (cause: unknown): cause is NodeFailedError => cause instanceof NodeFailedError
