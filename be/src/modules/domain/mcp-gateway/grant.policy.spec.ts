import { judgeGrant } from "./grant.policy"
import type { ToolGrant } from "./mcp-gateway.contracts"

const grant = (tool: string, mode: ToolGrant["mode"], limits: Partial<ToolGrant> = {}): ToolGrant => ({
    tool,
    mode,
    limitVnd: null,
    constraints: [],
    ...limits,
})

describe("grant.policy", () => {
    it("denies by default and for never", () => {
        expect(judgeGrant(null, {}, false)).toEqual({ kind: "refuse" })
        expect(judgeGrant(grant("a.b", "never"), {}, true)).toEqual({ kind: "refuse" })
        expect(judgeGrant(null, {}, false, true)).toEqual({ kind: "approval", reason: "no_rule" })
        expect(judgeGrant(null, {}, true, true)).toEqual({ kind: "allow" })
    })

    it("asks in ask mode unless the call replays an approval", () => {
        expect(judgeGrant(grant("a.b", "ask"), {}, false)).toEqual({ kind: "approval", reason: "ask_mode" })
        expect(judgeGrant(grant("a.b", "ask"), {}, true)).toEqual({ kind: "allow" })
    })

    it("asks over the discount and amount limits, allows within them", () => {
        const limited = grant("a.b", "auto", { constraints: [{ arg: "discountPct", max: 10 }], limitVnd: 1000 })
        expect(judgeGrant(limited, { discountPct: 15 }, false)).toEqual({ kind: "approval", reason: "price_exception" })
        expect(judgeGrant(limited, { amountVnd: 2000 }, false)).toEqual({ kind: "approval", reason: "over_limit_vnd" })
        expect(judgeGrant(limited, { discountPct: 10, amountVnd: 999 }, false)).toEqual({ kind: "allow" })
        expect(judgeGrant(limited, { discountPct: "50" }, false)).toEqual({ kind: "allow" })
        expect(judgeGrant(grant("a.b", "auto"), { amountVnd: 9e9 }, false)).toEqual({ kind: "allow" })
        expect(judgeGrant(grant("a.b", "auto"), { discountPct: 5 }, false)).toEqual({
            kind: "approval",
            reason: "price_exception",
        })
        expect(judgeGrant(grant("a.b", "auto"), { discountPct: 0 }, false)).toEqual({ kind: "allow" })
    })
})
