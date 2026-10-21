import { evaluateGate } from "@modules/domain/decisions"
import type { GatewayJson, GrantVerdict, ToolGrant } from "./mcp-gateway.contracts"

const numberOf = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null)

/** True when a numeric argument is above the grant's constraint on it; an argument without a constraint is not judged. */
const exceeds = (grant: ToolGrant, name: string, value: number): boolean =>
    grant.constraints.some((entry) => entry.arg === name && value > entry.max)

/**
 * The grant check of one call, through NIVO's own authority gate (`evaluateGate`) so there is one authority system: the grant is the
 * rule of the action "<tool>" (mode, `limit_vnd` against `amountVnd`), default deny. A numeric argument above one of the grant's
 * constraints (data per workspace: `{ arg, max }`, for example `{ arg: "quantity", max: 5 }` on shop.order.place) asks a person.
 * A side-effect tool with no rule asks a person; a read with no rule is denied. A replay of an approval passes the limits, never a
 * grant withdrawn (`never`) meanwhile. No business value and no argument name lives in code.
 */
export const judgeGrant = (
    grant: ToolGrant | null,
    args: GatewayJson,
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
    return !approved && broken ? { kind: "approval", reason: "over_constraint" } : { kind: "allow" }
}
