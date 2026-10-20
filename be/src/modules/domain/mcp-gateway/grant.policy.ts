import { evaluateGate } from "@modules/domain/decisions"
import type { GrantVerdict, JsonObject, ToolGrant } from "./mcp-gateway.contracts"

/** Arguments that change a price the connector quoted (a discount, a price or total override): a price exception. */
const PRICE_ARG = /discount|price|override/iu

const numberOf = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null)

/** True when an argument breaks the grant's constraint on it, or is an unconstrained price exception. */
const exceeds = (grant: ToolGrant, name: string, value: number): boolean => {
    const constraint = grant.constraints.find((entry) => entry.arg === name)
    if (constraint !== undefined) return value > constraint.max
    return PRICE_ARG.test(name) && value > 0
}

/**
 * The grant check of one call, through NIVO's own authority gate (`evaluateGate`) so there is one authority system: the grant is the
 * rule of the action "<tool>" (mode, `limit_vnd` against `amountVnd`), default deny. Generic argument constraints (configured per
 * workspace, for example `discountPct <= N` on hakuen.booking.confirm) and the price exception (a price/discount argument with no
 * constraint) ask a person. A side-effect tool with no rule asks a person; a read with no rule is denied. A replay of an approval
 * passes the limits, never a grant withdrawn (`never`) meanwhile. No business value lives in code.
 */
export const judgeGrant = (
    grant: ToolGrant | null,
    args: JsonObject,
    approved: boolean,
    sideEffect = false,
): GrantVerdict => {
    if (grant === null && sideEffect) return approved ? { kind: "allow" } : { kind: "approval", reason: "no_rule" }
    const verdict = evaluateGate({
        action: grant?.tool ?? "",
        rule:
            grant === null
                ? null
                : {
                      id: "",
                      department: "mcp",
                      action: grant.tool,
                      mode: grant.mode,
                      limit_vnd: grant.limitVnd,
                      required_fields: [],
                  },
        maxMode: null,
        proposal: { summary: "", fields: {}, amount_vnd: numberOf(args.amountVnd) },
        humanApproved: approved,
    })
    if (grant === null || verdict.reasons.includes("not_allowed")) return { kind: "refuse" }
    if (verdict.verdict === "ask")
        return { kind: "approval", reason: grant.mode === "ask" ? "ask_mode" : "over_limit_vnd" }
    const broken = Object.entries(args).some(([name, value]) => {
        const number = numberOf(value)
        return number !== null && exceeds(grant, name, number)
    })
    return !approved && broken ? { kind: "approval", reason: "price_exception" } : { kind: "allow" }
}
