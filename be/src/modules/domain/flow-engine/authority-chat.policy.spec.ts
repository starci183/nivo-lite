import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { AuthorityActionRecord } from "@modules/domain/authority-actions"
import {
    amountIn,
    appended,
    isThresholdSaid,
    modeOf,
    namesAction,
    namesOrder,
    saidOf,
    trimmed,
    wholeOf,
} from "./authority-chat.policy"

const SUBJECT = Symbol("authority-chat.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    amountIn,
                    appended,
                    isThresholdSaid,
                    modeOf,
                    namesAction,
                    namesOrder,
                    saidOf,
                    trimmed,
                    wholeOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<
        Pick<
            typeof import("./authority-chat.policy"),
            | "amountIn"
            | "appended"
            | "isThresholdSaid"
            | "modeOf"
            | "namesAction"
            | "namesOrder"
            | "saidOf"
            | "trimmed"
            | "wholeOf"
        >
    >(SUBJECT)
}

const actionOf = builder<AuthorityActionRecord>({
    action: "confirm_order",
    module_key: "sales",
    sort_order: 0,
    default_mode: "ask",
    default_limit_vnd: null,
    default_required_fields: [],
    amount_limit: true,
    max_mode: null,
    label: { vi: "X\u00e1c nh\u1eadn \u0111\u01a1n", en: "Confirm order" },
})

describe("authority chat policy", () => {
    it("folds the owner's words before matching known action names with word boundaries", async () => {
        const subject = await build()

        expect(subject.saidOf("  X\u00c1C NH\u1eacN \u0110\u01a0N  ")).toBe("xac nhan don")
        expect(subject.namesAction("confirm order", actionOf())).toBe(true)
        expect(subject.namesAction("border", actionOf())).toBe(false)
        expect(subject.namesOrder("confirm order")).toBe(true)
        expect(subject.namesOrder("xac nhan don")).toBe(true)
        expect(subject.namesOrder("border")).toBe(false)
    })

    it("uses both folded registry labels for an action added by another module", async () => {
        const subject = await build()

        const custom = actionOf({ action: "custom", label: { vi: "\u0110\u0103ng b\u00e0i", en: "Publish post" } })
        expect(subject.namesAction("hay dang bai", custom)).toBe(true)
        expect(subject.namesAction("publish post please", custom)).toBe(true)
        expect(subject.namesAction("publish poster", custom)).toBe(false)
    })

    it.each([
        ["don tren 20 trieu thi hoi toi", true],
        ["orders over 20 ask me", true],
        ["orders under 20m ask me", false],
        ["orders over 20m", false],
        ["over 20\nask me", true],
        ["over 20m\nask me", false],
        ["over ... ask", true],
        ["over 20m later ask", true],
        ["over 20m\nunder 30 ask", false],
    ])("recognizes asking above a threshold in %s", async (text, expected) => {
        const subject = await build()

        expect(subject.isThresholdSaid(text)).toBe(expected)
    })

    it.each([
        ["duoi 1,5 ty", 1_500_000_000],
        ["under 2 billion", 2_000_000_000],
        ["over 20m", 20_000_000],
        ["tren 2 trieu", 2_000_000],
        ["below 2k", 2000],
        ["toi da 2 nghin", 2000],
        ["den 2 ngan", 2000],
        ["up to 2.5", 3],
        ["over 0", null],
        ["over nonsense then under 3 million", 3_000_000],
        ["under 1.2.3 million", 1],
        ["over 0 then under 3 million", null],
        ["no amount", null],
        [`over ${"9".repeat(310)}`, null],
    ])("reads the VND limit in %s", async (text, expected) => {
        const subject = await build()

        expect(subject.amountIn(text)).toBe(expected)
    })
})

describe("authority chat policy", () => {
    it.each([
        [2.5, 3],
        [0, 0],
        [-1, null],
        [Number.POSITIVE_INFINITY, null],
        [Number.NaN, null],
        ["2", null],
        [null, null],
    ])("normalizes a whole number from %s", async (value, expected) => {
        const subject = await build()

        expect(subject.wholeOf(value)).toBe(expected)
    })

    it("trims optional text and appends nonempty lines to an optional stored value", async () => {
        const subject = await build()

        expect(subject.trimmed("  note  ")).toBe("note")
        expect(subject.trimmed(null)).toBe("")
        expect(subject.trimmed(undefined)).toBe("")
        expect(subject.appended(" old ", ["new", "", "last"])).toBe("old\nnew\nlast")
        expect(subject.appended(undefined, ["new"])).toBe("new")
        expect(subject.appended("  ", [])).toBe("")
    })

    it.each([
        ["auto", "auto"],
        ["ask", "ask"],
        ["never", "never"],
        ["other", null],
        [undefined, null],
    ])("accepts only a known mode from %s", async (value, expected) => {
        const subject = await build()

        expect(subject.modeOf(value)).toBe(expected)
    })
})
