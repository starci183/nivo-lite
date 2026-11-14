import { createHash } from "node:crypto"
import { isIP } from "node:net"
import { isPrivateAddress } from "@modules/platform/primitives"
import { canonicalJsonOf } from "./openapi-document.policy"
import { declaredPropertiesOf, typesOf, violationOf } from "./openapi-schema.policy"
import type {
    CallIdentity,
    JsonMembers,
    OptionalBaseUrlProblem,
    OptionalDryRunPlace,
    OptionalFlag,
    PinnedOperation,
    PinnedParameter,
    RequestPlanning,
    SchemaNode,
    ToolsAccountFacts,
} from "./openapi-tools.contracts"

/** The header an operation takes its replay key in, lower case. */
const IDEMPOTENCY_HEADER = "idempotency-key"

/** The switch of an operation that answers what it would do without doing it: a body member or a query parameter of this name. */
export const DRY_RUN = "dryRun"

/** The replay keys the provider writes start with this, so the outside system's log tells them from another caller's. */
const KEY_PREFIX = "nivo:"

/** A host as it is written, without the brackets of an IPv6 literal. */
const bareHostOf = (host: string): string => (host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host)

/** True for a host that is this machine: `localhost`, a name under it, `127.0.0.0/8` or `::1`. */
export const isLoopbackHost = (host: string): boolean => {
    const bare = bareHostOf(host).toLowerCase()
    if (bare === "localhost" || bare.endsWith(".localhost")) return true
    const family = isIP(bare)
    if (family === 4) return bare.startsWith("127.")
    return family === 6 && (bare === "::1" || bare === "0:0:0:0:0:0:0:1")
}

/**
 * Why a base URL may not be called, or null when it may. Everywhere: `https` to a host that is not written as a private address.
 * On a development site only, one more form: `http` or `https` to a LOOPBACK host (this machine), so a service under development
 * can be reached; any other private address (a LAN, link-local or metadata address) stays refused there too. What a name resolves
 * to is judged by `resolvedProblemOf` once it is resolved.
 */
export const baseUrlProblemOf = (baseUrl: string, development: boolean): OptionalBaseUrlProblem => {
    if (!URL.canParse(baseUrl)) return "not_a_url"
    const url = new URL(baseUrl)
    const host = bareHostOf(url.hostname)
    const web = url.protocol === "http:" || url.protocol === "https:"
    if (isLoopbackHost(host)) return development && web ? null : "private_host"
    if (url.protocol !== "https:") return "https_required"
    return isIP(host) !== 0 && isPrivateAddress(host) ? "private_host" : null
}

/** Why the address a host resolved to may not be called, or null: a private address that is not this machine on a development site. */
export const resolvedProblemOf = (address: string, development: boolean): OptionalBaseUrlProblem => {
    if (!isPrivateAddress(address)) return null
    return development && isLoopbackHost(address) ? null : "private_host"
}

/** What the provider fills a header with, or null for a header the caller gives. */
type Controlled = "workspace" | "idempotency" | "security"

/** What a call is planned against: the operation, the account and the security headers of its document. */
interface Plan {
    /** The operation. */
    readonly operation: PinnedOperation
    /** What the account says. */
    readonly account: ToolsAccountFacts
    /** The header names of the document's security schemes, lower case. */
    readonly securityHeaders: ReadonlyArray<string>
}

const controlOf = (parameter: PinnedParameter, plan: Plan): Controlled | null => {
    if (parameter.in !== "header") return null
    const name = parameter.name.toLowerCase()
    if (name === plan.account.workspaceHeader.toLowerCase()) return "workspace"
    if (name === IDEMPOTENCY_HEADER) return "idempotency"
    return plan.securityHeaders.includes(name) || name === "authorization" ? "security" : null
}

/** The members of an operation's body, by name. */
const bodyMembersOf = (operation: PinnedOperation): Readonly<Record<string, SchemaNode>> =>
    operation.body === null ? {} : declaredPropertiesOf(operation.body.schema)

/** Where an operation takes its dry-run switch, or null when it has none. */
export const dryRunPlaceOf = (operation: PinnedOperation): OptionalDryRunPlace => {
    const member = bodyMembersOf(operation)[DRY_RUN]
    if (member !== undefined && typesOf(member)?.includes("boolean") === true) return "body"
    const parameter = operation.parameters.find((entry) => entry.in === "query" && entry.name === DRY_RUN)
    return parameter !== undefined && typesOf(parameter.schema)?.includes("boolean") === true ? "query" : null
}

/**
 * The schema of the arguments a caller gives one operation: flat, the path and query parameters, the headers the provider does not
 * fill and the members of the JSON body, each by its own name; nothing else is admitted. The security header, the workspace header
 * and the replay key are never arguments.
 */
export const argumentsSchemaOf = (
    operation: PinnedOperation,
    account: ToolsAccountFacts,
    securityHeaders: ReadonlyArray<string>,
): SchemaNode => {
    const plan: Plan = { operation, account, securityHeaders }
    const given = operation.parameters.filter((parameter) => controlOf(parameter, plan) === null)
    const bodyRequired: ReadonlyArray<unknown> =
        operation.body !== null && Array.isArray(operation.body.schema.required) ? operation.body.schema.required : []
    const required = [
        ...given.filter((parameter) => parameter.required).map((parameter) => parameter.name),
        ...bodyRequired.filter((name): name is string => typeof name === "string"),
    ].filter((name) => name !== DRY_RUN)
    return {
        type: "object",
        properties: {
            ...Object.fromEntries(given.map((parameter) => [parameter.name, parameter.schema])),
            ...bodyMembersOf(operation),
        },
        required: [...new Set(required)],
        additionalProperties: false,
    }
}

/**
 * The replay key of one call: `nivo:<sha256(workspace, step, tool, arguments, dry run)>`. The same step with the same arguments sends
 * the same key, so the outside system answers its stored result instead of acting twice; a dry run and the real run of one step
 * differ, so a stored dry-run answer is never taken for the act.
 */
export const replayKeyOf = (identity: CallIdentity, args: JsonMembers, dryRun: OptionalFlag): string =>
    `${KEY_PREFIX}${createHash("sha256")
        .update(canonicalJsonOf([identity.workspaceId, identity.stepKey, identity.tool, args, dryRun]))
        .digest("hex")}`

/** Whether a call is a dry run: always on an account that is not live; on a live one unless the caller says `false`. */
const dryRunOf = (place: OptionalDryRunPlace, account: ToolsAccountFacts, asked: unknown): OptionalFlag => {
    if (place === null) return null
    return account.live ? asked !== false : true
}

/** What one call is: its checked arguments, who calls, and what the provider decided about the dry run. */
interface Call {
    /** The caller's arguments. */
    readonly args: JsonMembers
    /** Who calls. */
    readonly identity: CallIdentity
    /** Where the operation takes its dry-run switch. */
    readonly place: OptionalDryRunPlace
    /** Whether the call is a dry run. */
    readonly dryRun: OptionalFlag
}

/** The value one parameter is sent with: `skip` for none, `no_step` for a replay key that cannot be made. */
type Filled = { readonly kind: "value"; readonly value: unknown } | { readonly kind: "skip" } | { readonly kind: "no_step" }

const SKIP: Filled = { kind: "skip" }

const filledOf = (parameter: PinnedParameter, plan: Plan, call: Call): Filled => {
    const control = controlOf(parameter, plan)
    if (control === "security") return SKIP
    if (control === "workspace") return { kind: "value", value: call.identity.workspaceId }
    if (control === "idempotency") {
        if (plan.operation.method === "GET") return SKIP
        const step = call.identity.stepKey
        if (step === null || step.trim() === "") return { kind: "no_step" }
        return { kind: "value", value: replayKeyOf(call.identity, call.args, call.dryRun) }
    }
    if (parameter.name === DRY_RUN && call.place === "query") return { kind: "value", value: call.dryRun }
    const given = call.args[parameter.name]
    return given === undefined ? SKIP : { kind: "value", value: given }
}

/** The JSON body of a call: the body members the caller gave, with the dry-run switch as the provider decided it. */
const bodyOf = (operation: PinnedOperation, call: Call): JsonMembers =>
    Object.fromEntries(
        Object.keys(bodyMembersOf(operation)).flatMap((name): Array<[string, unknown]> => {
            if (name === DRY_RUN && call.place === "body") return [[name, call.dryRun]]
            const given = call.args[name]
            return given === undefined ? [] : [[name, given]]
        }),
    )

/**
 * The request of one call, from the caller's flat arguments: they are checked against the operation's own schemas, then placed (path,
 * query, header, body). The provider fills what a caller never gives: the workspace header (the calling workspace), the replay key
 * of a write that takes one (a write with no step key is refused: it could act twice) and the dry-run switch (see `dryRunOf`). The
 * security header is the client's to add from the sealed key.
 */
export const plannedRequestOf = (
    operation: PinnedOperation,
    account: ToolsAccountFacts,
    securityHeaders: ReadonlyArray<string>,
    args: JsonMembers,
    identity: CallIdentity,
): RequestPlanning => {
    const plan: Plan = { operation, account, securityHeaders }
    const problem = violationOf(argumentsSchemaOf(operation, account, securityHeaders), args)
    if (problem !== null) return { ok: false, problem }
    const place = dryRunPlaceOf(operation)
    const call: Call = { args, identity, place, dryRun: dryRunOf(place, account, args[DRY_RUN]) }
    const filled = operation.parameters.map((parameter) => ({ parameter, filled: filledOf(parameter, plan, call) }))
    if (filled.some((entry) => entry.filled.kind === "no_step")) return { ok: false, problem: "no step key" }
    const values = Object.fromEntries(
        filled.flatMap((entry): Array<[string, unknown]> =>
            entry.filled.kind === "value" ? [[entry.parameter.name, entry.filled.value]] : [],
        ),
    )
    const sendsBody = operation.body !== null && operation.method !== "GET"
    return {
        ok: true,
        request: {
            params: operation.parameters
                .filter((parameter) => controlOf(parameter, plan) !== "security")
                .map((parameter) => ({ name: parameter.name, in: parameter.in, required: parameter.required })),
            input: sendsBody ? { ...values, body: bodyOf(operation, call) } : values,
            dryRun: call.dryRun,
            dryRunForced: place !== null && !account.live && args[DRY_RUN] === false,
        },
    }
}
