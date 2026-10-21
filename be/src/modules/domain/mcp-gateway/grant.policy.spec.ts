import { Test } from "@nestjs/testing"
import { judgeGrant } from "./grant.policy"
import type { ToolGrant } from "./mcp-gateway.contracts"

const grant = (tool: string, mode: ToolGrant["mode"], limits: Partial<ToolGrant> = {}): ToolGrant => ({
    tool,
    mode,
    limitVnd: null,
    constraints: [],
    ...limits,
})

/** The members of the subject under test. */
interface Subject {
    readonly judgeGrant: typeof judgeGrant
}

const SUBJECT = Symbol("grant.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { judgeGrant } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("grant.policy", () => {
    it("denies by default and for never", async () => {
        const subject = await build()
        expect(subject.judgeGrant(null, {}, false)).toEqual({ kind: "refuse" })
        expect(subject.judgeGrant(grant("a.b", "never"), {}, true)).toEqual({ kind: "refuse" })
        expect(subject.judgeGrant(null, {}, false, true)).toEqual({ kind: "approval", reason: "no_rule" })
        expect(subject.judgeGrant(null, {}, true, true)).toEqual({ kind: "allow" })
    })

    it("asks in ask mode unless the call replays an approval", async () => {
        const subject = await build()
        expect(subject.judgeGrant(grant("a.b", "ask"), {}, false)).toEqual({ kind: "approval", reason: "ask_mode" })
        expect(subject.judgeGrant(grant("a.b", "ask"), {}, true)).toEqual({ kind: "allow" })
    })

    it("asks over a data constraint or the amount limit, allows within them and leaves other arguments alone", async () => {
        const subject = await build()
        const limited = grant("a.b", "auto", { constraints: [{ arg: "quantity", max: 10 }], limitVnd: 1000 })

        expect(subject.judgeGrant(limited, { quantity: 15 }, false)).toEqual({
            kind: "approval",
            reason: "over_constraint",
        })
        expect(subject.judgeGrant(limited, { quantity: 15 }, true)).toEqual({ kind: "allow" })
        expect(subject.judgeGrant(limited, { amountVnd: 2000 }, false)).toEqual({
            kind: "approval",
            reason: "over_limit_vnd",
        })
        expect(subject.judgeGrant(limited, { quantity: 10, amountVnd: 999 }, false)).toEqual({ kind: "allow" })
        expect(subject.judgeGrant(limited, { quantity: "50" }, false)).toEqual({ kind: "allow" })
        expect(subject.judgeGrant(grant("a.b", "auto"), { amountVnd: 9e9, rate: 99 }, false)).toEqual({ kind: "allow" })
    })
})
