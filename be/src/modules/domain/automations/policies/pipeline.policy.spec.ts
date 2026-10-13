import { AutomationsErrorCode } from "../errors/automations.error"
import { TEXT, buildPipelineRow, buildTemplate } from "@tests/fixtures/builders/automations.builder"
import {
    TRUST_THRESHOLD,
    blankPipeline,
    planAutoSend,
    planDecision,
    planDismiss,
    planGoogleAccount,
    planSave,
    planToggle,
    writeOf,
} from "./pipeline.policy"

const BODY = "Hello {ten_khach}, thank you"

describe("writeOf", () => {
    it("is a blank pipeline before the first switch", () => {
        expect(writeOf(null)).toEqual(blankPipeline())
        expect(blankPipeline()).toMatchObject({ enabled: false, body: null, autoSend: false })
    })

    it("takes the editable columns of a stored row", () => {
        const row = buildPipelineRow({
            body: "b",
            body_version: 2,
            based_on_context: 3,
            approval_streak: 4,
            trust_offered_at: "2026-10-01T00:00:00.000Z",
            auto_send: true,
            config: { a: 1 },
        })

        expect(writeOf(row)).toEqual({
            enabled: true,
            dismissed: false,
            config: { a: 1 },
            body: "b",
            bodyVersion: 2,
            basedOnContext: 3,
            approvalStreak: 4,
            trustOfferedAt: "2026-10-01T00:00:00.000Z",
            autoSend: true,
        })
    })
})

describe("planToggle", () => {
    const def = buildTemplate({
        settings: [{ key: "days", kind: "number", label: TEXT, min: 1, max: 9 }],
        defaults: { days: 3 },
        defaultBody: { vi: BODY, en: BODY },
    })

    it("switches off without any check", () => {
        expect(planToggle(def, { ...blankPipeline(), enabled: true }, false, [], 1).enabled).toBe(false)
    })

    it("switches on with the standard wording and the settings resolved", () => {
        const write = planToggle(def, blankPipeline(), true, [], 7)

        expect(write).toMatchObject({
            enabled: true,
            dismissed: false,
            config: { days: 3 },
            body: BODY,
            bodyVersion: 1,
            basedOnContext: 7,
        })
    })

    it("keeps the wording the owner approved and a template with none", () => {
        const approved = planToggle(def, { ...blankPipeline(), body: "mine" }, true, [], 7)
        const plain = planToggle(buildTemplate(), blankPipeline(), true, [], null)

        expect(approved).toMatchObject({ body: "mine", bodyVersion: 0 })
        expect(plain).toMatchObject({ body: null, bodyVersion: 0 })
    })

    it("refuses a template nothing runs yet", () => {
        expect(() => planToggle(buildTemplate({ executor: "definition" }), blankPipeline(), true, [], null)).toThrow(
            expect.objectContaining({ code: AutomationsErrorCode.ComingSoon }),
        )
    })

    it("names what is missing", () => {
        const missing = [
            { kind: "module" as const, key: "sales", label: { vi: "Ban hang", en: "Sales" } },
            { kind: "channel" as const, key: "customer_chat", label: { vi: "Chat", en: "Chat" } },
        ]

        expect(() => planToggle(def, blankPipeline(), true, missing, null)).toThrow(
            expect.objectContaining({
                code: AutomationsErrorCode.RequirementMissing,
                params: { items: "Ban hang, Chat" },
            }),
        )
    })
})

describe("planSave", () => {
    const def = buildTemplate({
        settings: [
            { key: "days", kind: "number", label: TEXT, min: 1, max: 9 },
            { key: "flag", kind: "toggle", label: TEXT },
            { key: "note", kind: "text", label: TEXT },
        ],
        defaults: { days: 3 },
        variables: ["ten_khach"],
        defaultBody: { vi: BODY, en: BODY },
    })
    const current = {
        ...blankPipeline(),
        body: BODY,
        bodyVersion: 1,
        approvalStreak: 5,
        trustOfferedAt: "t",
        autoSend: true,
    }

    it("changes nothing when nothing is saved", () => {
        expect(planSave(def, current, { values: undefined, body: undefined }, 1)).toBe(current)
    })

    it("saves the values of the settings only, clamped", () => {
        const values = { days: 50, ghost: "x", flag: true, note: "hello" }
        const next = planSave(def, current, { values, body: undefined }, 1)

        expect(next.config).toEqual({ days: 9, flag: true, note: "hello" })
    })

    it("ignores a value of a setting that is neither a text, a number nor a switch", () => {
        const next = planSave(def, current, { values: { days: { nested: 1 } }, body: undefined }, 1)

        expect(next.config).toEqual({ days: 3, flag: false, note: "" })
    })

    it("saves a new wording and restarts the trust ladder", () => {
        const next = planSave(def, current, { values: undefined, body: "  Dear {ten_khach}, welcome  " }, 4)

        expect(next).toMatchObject({
            body: "Dear {ten_khach}, welcome",
            bodyVersion: 2,
            basedOnContext: 4,
            approvalStreak: 0,
            trustOfferedAt: null,
            autoSend: false,
        })
    })

    it("refuses a wording for a template that sends no message", () => {
        expect(() => planSave(buildTemplate(), current, { values: undefined, body: BODY }, 1)).toThrow(
            expect.objectContaining({ code: AutomationsErrorCode.NoMessage }),
        )
    })

    it("refuses a wording that is too short or names a blank the template does not offer", () => {
        expect(() => planSave(def, current, { values: undefined, body: "short" }, 1)).toThrow(
            expect.objectContaining({ code: AutomationsErrorCode.BodyTooShort }),
        )
        expect(() => planSave(def, current, { values: undefined, body: "A long {ghost} wording" }, 1)).toThrow(
            expect.objectContaining({ code: AutomationsErrorCode.BodyUnknownVariable, params: { variable: "ghost" } }),
        )
    })
})

describe("planDismiss", () => {
    it("hides a template and switches it off, and restores it without switching it on", () => {
        const on = { ...blankPipeline(), enabled: true }

        expect(planDismiss(on, true)).toMatchObject({ dismissed: true, enabled: false })
        expect(planDismiss({ ...on, dismissed: true }, false)).toMatchObject({ dismissed: false, enabled: true })
    })
})

describe("planAutoSend", () => {
    it("accepts or declines an offer that was made", () => {
        const offered = { ...blankPipeline(), trustOfferedAt: "t", approvalStreak: 20 }

        expect(planAutoSend(offered, true)).toMatchObject({ autoSend: true, trustOfferedAt: "t" })
        expect(planAutoSend(offered, false)).toMatchObject({ autoSend: false, trustOfferedAt: null, approvalStreak: 0 })
    })

    it("refuses an answer to an offer that was not made", () => {
        expect(() => planAutoSend(blankPipeline(), true)).toThrow(
            expect.objectContaining({ code: AutomationsErrorCode.TrustNotOffered }),
        )
    })
})

describe("planGoogleAccount", () => {
    const def = buildTemplate({ requires: { modules: [], channels: [], connections: ["google"], capabilities: [] } })

    it("moves the sheet to another account and forgets the old spreadsheet", () => {
        const current = { ...blankPipeline(), config: { googleConnectionId: "g-1", spreadsheetId: "s", sheetUrl: "u" } }

        expect(planGoogleAccount(def, current, "g-2", ["g-2"]).config).toEqual({
            googleConnectionId: "g-2",
            spreadsheetId: "",
            sheetUrl: "",
        })
    })

    it("keeps the pipeline when the account is the same", () => {
        const current = { ...blankPipeline(), config: { googleConnectionId: "g-1" } }

        expect(planGoogleAccount(def, current, "g-1", ["g-1"])).toBe(current)
    })

    it("refuses a template that does not write to Google and an account the workspace does not have", () => {
        expect(() => planGoogleAccount(buildTemplate(), blankPipeline(), "g-1", ["g-1"])).toThrow(
            expect.objectContaining({ code: AutomationsErrorCode.GoogleNotUsed }),
        )
        expect(() => planGoogleAccount(def, blankPipeline(), "g-9", ["g-1"])).toThrow(
            expect.objectContaining({ code: AutomationsErrorCode.GoogleAccountUnknown }),
        )
    })
})

describe("planDecision", () => {
    const now = "2026-10-12T00:00:00.000Z"

    it("counts an approval", () => {
        const plan = planDecision({ ...blankPipeline(), approvalStreak: 3 }, "approved", now)

        expect(plan).toEqual({
            write: expect.objectContaining({ approvalStreak: 4, trustOfferedAt: null }),
            offered: false,
        })
    })

    it("resets the streak on any other outcome", () => {
        expect(planDecision({ ...blankPipeline(), approvalStreak: 3 }, "edited", now).write.approvalStreak).toBe(0)
    })

    it("offers sending by itself once, at the threshold", () => {
        const plan = planDecision({ ...blankPipeline(), approvalStreak: TRUST_THRESHOLD - 1 }, "approved", now)
        const again = planDecision(plan.write, "approved", now)

        expect(plan).toMatchObject({ offered: true, write: { trustOfferedAt: now } })
        expect(again).toMatchObject({ offered: false, write: { trustOfferedAt: now } })
    })

    it("does not offer to one who already sends by itself", () => {
        const plan = planDecision(
            { ...blankPipeline(), approvalStreak: TRUST_THRESHOLD, autoSend: true },
            "approved",
            now,
        )

        expect(plan.offered).toBe(false)
    })
})
