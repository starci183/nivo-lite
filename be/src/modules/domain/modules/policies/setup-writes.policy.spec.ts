import { Test } from "@nestjs/testing"
import { ACCOUNTING_MODULE } from "../accounting.contracts"
import type { RuleCardPayload } from "@modules/domain/module-setup-writes"
import type { AuthorityActionDefinition, FactWrite, ModuleDefinition, ModuleGate } from "../modules.contracts"
import {
    cardOf as realCardOf,
    gateWritesOf as realGateWritesOf,
    sanitizeWrites as realSanitizeWrites,
    targetKeyOf as realTargetKeyOf,
    vndOf as realVndOf,
    writeSpecLines as realWriteSpecLines,
} from "./setup-writes.policy"
import type { OpenGap, ProposedFact, ProposedRule } from "./setup-writes.policy"

const SUBJECT = Symbol("setup-writes.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    cardOf: realCardOf,
                    gateWritesOf: realGateWritesOf,
                    sanitizeWrites: realSanitizeWrites,
                    targetKeyOf: realTargetKeyOf,
                    vndOf: realVndOf,
                    writeSpecLines: realWriteSpecLines,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./setup-writes.policy")>(SUBJECT)
}

const gateOf = (key: string, writes?: ModuleGate["writes"]): ModuleGate => ({
    key,
    label_vi: key,
    label_en: key,
    hint_vi: key,
    hint_en: key,
    ...(writes === undefined ? {} : { writes }),
})

const actionOf = (action: string, changes: Partial<AuthorityActionDefinition> = {}): AuthorityActionDefinition => ({
    action,
    label: { en: `${action} label`, vi: action },
    mode: "ask",
    limitVnd: null,
    requiredFields: [],
    amountLimit: true,
    maxMode: null,
    note: "",
    next: [],
    ...changes,
})

const MODULE: ModuleDefinition = {
    ...ACCOUNTING_MODULE,
    audience: "customer",
    gates: [
        gateOf("hours", [{ kind: "fact", subjectType: "business", attributeLabel: "Hours", scope: "internal" }]),
        gateOf("product", [{ kind: "fact", subjectType: "product", attributeLabel: "Price", scope: "public" }]),
        gateOf("multiple", [
            { kind: "fact", subjectType: "policy", attributeLabel: "Delivery", scope: "restricted" },
            { kind: "fact", subjectType: "policy", attributeLabel: "Returns", scope: "internal" },
        ]),
        gateOf("mode", [{ kind: "rule", action: "send", field: "mode" }]),
        gateOf("capped", [{ kind: "rule", action: "charge", field: "mode" }]),
        gateOf("limit", [{ kind: "rule", action: "send", field: "limit_vnd" }]),
        gateOf("no_limit", [{ kind: "rule", action: "notify", field: "limit_vnd" }]),
        gateOf("unknown", [{ kind: "rule", action: "missing", field: "mode" }]),
        gateOf("empty"),
    ],
    authorityActions: [
        actionOf("send"),
        actionOf("charge", { maxMode: "ask" }),
        actionOf("notify", { amountLimit: false }),
    ],
}

const FACT: ProposedFact = {
    gateKey: "hours",
    kind: "fact",
    payload: {
        subjectType: "business",
        subjectLabel: "Caf\u00e9 Shop",
        attributeLabel: "Opening Hours",
        value: "8 to 5",
        scope: "public",
    },
}

const RULE: ProposedRule = {
    gateKey: "mode",
    kind: "rule",
    payload: { action: "send", field: "mode", mode: "ask", limitVnd: undefined },
}

const GAP: OpenGap = { id: "g1", question: "Price?", count: 3, topic: "Tea", attributeGuess: "Price" }

describe("vndOf", () => {
    it.each([
        [0, 0],
        [1.6, 2],
        [-1, null],
        [Number.NaN, null],
        [Number.POSITIVE_INFINITY, null],
        [null, null],
        [{}, null],
        ["", null],
        [" ", null],
        ["not an amount", null],
        [".. tri\u1ec7u", null],
        ["9".repeat(400), null],
        ["20.000.000", 20000000],
        ["20,000,000", 20000000],
        ["1,5 t\u1ef7", 1500000000],
        ["20 tri\u1ec7u", 20000000],
        ["20 tr", 20000000],
        ["2m", 2000000],
        ["1.5k", 1500],
        ["2 ngh\u00ecn", 2000],
        ["2 ng\u00e0n", 2000],
        ["1,5k ignored\nbody", 1500],
        ["1.5\u{1f642}\nbody", 15],
        [".k", null],
        [",k", null],
        ["1,2,3k", null],
        ["1..2\nbody", 12],
        ["24k:notes", 24000],
        ["20 trieu ignored", 20000000],
        ["1,5 ty", 1500000000],
        ["20.000 ignored", 20000],
        ["20x 4 trieu", 20],
        ["invalid 20 trieu", null],
    ])("reads numeric values and prefixes as VND: %s", async (raw, expected) => {
        const { vndOf } = await buildSubject()

        expect(vndOf(raw)).toBe(expected)
    })
})

describe("gateWritesOf, targetKeyOf and cardOf", () => {
    it("reads declared writes and answers an empty list for gates without them", async () => {
        const { gateWritesOf } = await buildSubject()

        expect(gateWritesOf(MODULE, "hours")).toEqual([
            { kind: "fact", subjectType: "business", attributeLabel: "Hours", scope: "internal" },
        ])
        expect(gateWritesOf(MODULE, "empty")).toEqual([])
        expect(gateWritesOf(MODULE, "absent")).toEqual([])
    })

    it("normalizes fact targets, keys rules by action and stores the completed payload", async () => {
        const { cardOf, targetKeyOf } = await buildSubject()

        expect(targetKeyOf(FACT)).toBe("fact:cafe-shop|opening-hours")
        expect(targetKeyOf(RULE)).toBe("rule:send")
        expect(cardOf(FACT, FACT.payload)).toEqual({
            gate_key: "hours",
            kind: "fact",
            target_key: "fact:cafe-shop|opening-hours",
            payload: FACT.payload,
        })
        const completed: RuleCardPayload = { action: "send", field: "mode", mode: "ask", limitVnd: 5000 }
        expect(cardOf(RULE, completed)).toEqual({
            gate_key: "mode",
            kind: "rule",
            target_key: "rule:send",
            payload: completed,
        })
    })
})

describe("sanitizeWrites", () => {
    it.each([null, {}, "writes"])("answers no writes for a non-array input", async (raw) => {
        const { sanitizeWrites } = await buildSubject()

        expect(sanitizeWrites(MODULE, raw, [], "Shop")).toEqual([])
    })

    it("rejects non-object, empty, unknown and undeclared writes", async () => {
        const { sanitizeWrites } = await buildSubject()

        expect(
            sanitizeWrites(
                MODULE,
                [
                    null,
                    [],
                    "fact",
                    {},
                    { gate: "hours", kind: "fact", value: " " },
                    { gate: "hours", kind: "fact", value: 1 },
                    { gate: "hours", kind: "other", value: "8 to 5" },
                    { gate: "hours", kind: "fact", attribute: "Price", value: "8 to 5" },
                    { gate: "multiple", kind: "fact", value: "Free", subject: "Policy" },
                    { gate: "product", kind: "fact", value: "50" },
                    { gate: "absent", kind: "fact", value: "50", subject: "Tea" },
                    { gate: "empty", kind: "rule", action: "send", mode: "ask" },
                    { gate: "mode", kind: "rule", action: "other", mode: "ask" },
                    { gate: "unknown", kind: "rule", action: "missing", mode: "ask" },
                    { gate: "mode", kind: "rule", action: "send", mode: "sometimes" },
                    { gate: "capped", kind: "rule", action: "charge", mode: "auto" },
                    { gate: "limit", kind: "rule", action: "send", limit_vnd: "no" },
                    { gate: "limit", kind: "rule", action: "send", limit_vnd: 0 },
                    { gate: "no_limit", kind: "rule", action: "notify", limit_vnd: 2000 },
                ],
                [],
                "Shop",
            ),
        ).toEqual([])
        expect(sanitizeWrites(MODULE, [{ gate: "hours", kind: "fact", value: "8 to 5" }], [], "")).toEqual([])
    })
})

describe("sanitizeWrites", () => {
    it("uses the declared fact attribute, scope and subject type while trimming and limiting owner text", async () => {
        const { sanitizeWrites } = await buildSubject()

        expect(
            sanitizeWrites(
                MODULE,
                [
                    { gate: " hours ", kind: "fact", value: " 8 to 5 " },
                    {
                        gate: "product",
                        kind: "fact",
                        attribute: "price",
                        subject: ` ${"s".repeat(165)} `,
                        value: "v".repeat(2005),
                    },
                    { gate: "multiple", kind: "fact", attribute: " DELIVERY ", subject: " Policy ", value: " Free " },
                ],
                [],
                "Shop",
            ),
        ).toEqual([
            {
                gateKey: "hours",
                kind: "fact",
                payload: {
                    subjectType: "business",
                    subjectLabel: "Shop",
                    attributeLabel: "Hours",
                    value: "8 to 5",
                    scope: "internal",
                },
            },
            {
                gateKey: "product",
                kind: "fact",
                payload: {
                    subjectType: "product",
                    subjectLabel: "s".repeat(160),
                    attributeLabel: "Price",
                    value: "v".repeat(2000),
                    scope: "public",
                },
            },
            {
                gateKey: "multiple",
                kind: "fact",
                payload: {
                    subjectType: "policy",
                    subjectLabel: "Policy",
                    attributeLabel: "Delivery",
                    value: "Free",
                    scope: "restricted",
                },
            },
        ])
    })
})

describe("sanitizeWrites", () => {
    it.each([undefined, null, "", "unrecognized"])(
        "defaults a malformed declared subject type %s to other",
        async (subjectType) => {
            const { sanitizeWrites } = await buildSubject()

            const write: FactWrite = {
                kind: "fact",
                subjectType: "product",
                attributeLabel: "Price",
                scope: "public",
            }
            Object.defineProperty(write, "subjectType", { value: subjectType })
            const module = { ...MODULE, gates: [gateOf("product", [write])] }
            expect(
                sanitizeWrites(module, [{ gate: "product", kind: "fact", subject: "Tea", value: "50" }], [], "Shop"),
            ).toEqual([
                {
                    gateKey: "product",
                    kind: "fact",
                    payload: {
                        subjectType: "other",
                        subjectLabel: "Tea",
                        attributeLabel: "Price",
                        value: "50",
                        scope: "public",
                    },
                },
            ])
        },
    )

    it("keeps valid modes and a positive amount while leaving the other half of a rule unset", async () => {
        const { sanitizeWrites } = await buildSubject()

        expect(
            sanitizeWrites(MODULE, [{ gate: "mode", kind: "rule", action: " send ", mode: "auto" }], [], "Shop"),
        ).toEqual([
            {
                gateKey: "mode",
                kind: "rule",
                payload: { action: "send", field: "mode", mode: "auto", limitVnd: undefined },
            },
        ])
        expect(
            sanitizeWrites(MODULE, [{ gate: "capped", kind: "rule", action: "charge", mode: "never" }], [], "Shop"),
        ).toEqual([
            {
                gateKey: "capped",
                kind: "rule",
                payload: { action: "charge", field: "mode", mode: "never", limitVnd: undefined },
            },
        ])
        expect(
            sanitizeWrites(
                MODULE,
                [{ gate: "limit", kind: "rule", action: "send", limit_vnd: "20 tri\u1ec7u" }],
                [],
                "Shop",
            ),
        ).toEqual([
            {
                gateKey: "limit",
                kind: "rule",
                payload: { action: "send", field: "limit_vnd", mode: null, limitVnd: 20000000 },
            },
        ])
    })
})

describe("sanitizeWrites", () => {
    it("answers a gap using its guesses or explicit labels and uses the module audience", async () => {
        const { sanitizeWrites } = await buildSubject()

        expect(
            sanitizeWrites(MODULE, [{ gate: "gap", kind: "fact", gap: " g1 ", value: "50" }], [GAP], "Shop"),
        ).toEqual([
            {
                gateKey: "gap",
                kind: "fact",
                payload: {
                    subjectType: "other",
                    subjectLabel: "Tea",
                    attributeLabel: "Price",
                    value: "50",
                    scope: "public",
                    gapId: "g1",
                },
            },
        ])
        expect(
            sanitizeWrites(
                { ...MODULE, audience: "internal" },
                [{ gate: "gap", kind: "fact", gap: "g1", subject: "Coffee", attribute: "Stock", value: "5" }],
                [GAP],
                "Shop",
            ),
        ).toEqual([
            {
                gateKey: "gap",
                kind: "fact",
                payload: {
                    subjectType: "other",
                    subjectLabel: "Coffee",
                    attributeLabel: "Stock",
                    value: "5",
                    scope: "internal",
                    gapId: "g1",
                },
            },
        ])
        expect(
            sanitizeWrites(
                MODULE,
                [{ gate: "gap", kind: "fact", gap: "g1", value: "50" }],
                [{ ...GAP, topic: "s".repeat(165), attributeGuess: "a".repeat(125) }],
                "Shop",
            ),
        ).toEqual([
            {
                gateKey: "gap",
                kind: "fact",
                payload: {
                    subjectType: "other",
                    subjectLabel: "s".repeat(160),
                    attributeLabel: "a".repeat(120),
                    value: "50",
                    scope: "public",
                    gapId: "g1",
                },
            },
        ])
    })
})

describe("sanitizeWrites", () => {
    it("rejects gaps without a matching id, attribute or subject", async () => {
        const { sanitizeWrites } = await buildSubject()

        expect(
            sanitizeWrites(
                MODULE,
                [{ gate: "gap", kind: "fact", gap: "missing", subject: "Tea", attribute: "Price", value: "50" }],
                [GAP],
                "Shop",
            ),
        ).toEqual([])
        expect(
            sanitizeWrites(
                MODULE,
                [{ gate: "gap", kind: "fact", gap: "g1", value: "50" }],
                [{ ...GAP, attributeGuess: null }],
                "Shop",
            ),
        ).toEqual([])
        expect(
            sanitizeWrites(
                MODULE,
                [{ gate: "gap", kind: "fact", gap: "g1", value: "50" }],
                [{ ...GAP, topic: null }],
                "Shop",
            ),
        ).toEqual([])
    })

    it("keeps the latest write to a target and limits each turn to eight distinct targets", async () => {
        const { sanitizeWrites } = await buildSubject()

        const raw = Array.from({ length: 9 }, (_, at) => ({
            gate: "product",
            kind: "fact",
            subject: `Tea ${at}`,
            value: `${at}`,
        }))

        expect(
            sanitizeWrites(
                MODULE,
                [...raw, { gate: "product", kind: "fact", subject: "Tea 0", value: "updated" }],
                [],
                "Shop",
            ),
        ).toEqual(
            Array.from({ length: 8 }, (_, at) => ({
                gateKey: "product",
                kind: "fact",
                payload: {
                    subjectType: "product",
                    subjectLabel: `Tea ${at}`,
                    attributeLabel: "Price",
                    value: at === 0 ? "updated" : `${at}`,
                    scope: "public",
                },
            })),
        )
    })
})

describe("writeSpecLines", () => {
    it("describes fact audiences, both rule fields, mode caps and unknown actions", async () => {
        const { writeSpecLines } = await buildSubject()

        expect(writeSpecLines(MODULE)).toEqual([
            '- gate hours: fact | subjectType business | attribute "Hours" | audience internal',
            '- gate product: fact | subjectType product | attribute "Price" | audience public',
            '- gate multiple: fact | subjectType policy | attribute "Delivery" | audience restricted',
            '- gate multiple: fact | subjectType policy | attribute "Returns" | audience internal',
            '- gate mode: rule | action send (send label) | field mode: "auto" (runs by itself), ' +
                '"ask" (asks the owner first) or "never"',
            '- gate capped: rule | action charge (charge label) | field mode: "auto" (runs by ' +
                'itself), "ask" (asks the owner first) or "never" (never "auto")',
            "- gate limit: rule | action send (send label) | field limit_vnd: the amount in VND " +
                "below which it runs by itself",
            "- gate no_limit: rule | action notify (notify label) | field limit_vnd: the amount " +
                "in VND below which it runs by itself",
            '- gate unknown: rule | action missing (missing) | field mode: "auto" (runs by ' +
                'itself), "ask" (asks the owner first) or "never" (never "auto")',
        ])
    })
})
