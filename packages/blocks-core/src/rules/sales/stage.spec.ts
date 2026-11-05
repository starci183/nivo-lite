import {
    LEAD_STAGES,
    MIN_REASON_CHARS,
    OPEN_STAGES,
    classifiedStage,
    isLeadStage,
    isOpenStage,
    planMove,
    stageAfterConfirm,
} from "./stage"
import { SALES_SETTINGS_DEFAULTS } from "./settings"

const SETTINGS = SALES_SETTINGS_DEFAULTS

describe("the stages of a lead", () => {
    it("lists the five stages of the pipeline in order", () => {
        expect(LEAD_STAGES).toEqual(["new", "qualified", "proposal", "won", "lost"])
        expect(OPEN_STAGES).toEqual(["new", "qualified", "proposal"])
    })

    it("tells a stage from any other text", () => {
        expect(isLeadStage("won")).toBe(true)
        expect(isLeadStage("contacted")).toBe(false)
    })

    it("calls the first three stages open and the last two closed", () => {
        expect(LEAD_STAGES.map(isOpenStage)).toEqual([true, true, true, false, false])
    })
})

describe("planMove", () => {
    it("refuses to move a deal to the stage it is in", () => {
        expect(planMove("new", "new", null, SETTINGS, false)).toEqual({ kind: "refused", reason: "same_stage" })
    })

    it("lets an open deal go to any other stage", () => {
        expect(planMove("new", "proposal", null, SETTINGS, false)).toMatchObject({ kind: "move", stage: "proposal" })
        expect(planMove("proposal", "new", null, SETTINGS, false)).toMatchObject({ kind: "move", stage: "new" })
        expect(planMove("qualified", "lost", "went cold", SETTINGS, false)).toMatchObject({
            kind: "move",
            stage: "lost",
        })
    })

    it("lets a closed deal switch to the other closed outcome while the settings allow it", () => {
        expect(planMove("won", "lost", "refunded", SETTINGS, false)).toMatchObject({ kind: "move", stage: "lost" })
        expect(planMove("lost", "won", "came back", SETTINGS, false)).toMatchObject({ kind: "move", stage: "won" })
    })

    it("refuses the switch of a closed deal when the settings forbid it", () => {
        const settings = { ...SETTINGS, closedDealsCanFlip: false }
        expect(planMove("won", "lost", "refunded", settings, true)).toEqual({
            kind: "refused",
            reason: "stage_not_allowed",
        })
    })

    it("lets only the owner reopen a closed deal while the settings ask for approval", () => {
        expect(planMove("won", "new", null, SETTINGS, false)).toEqual({ kind: "refused", reason: "reopen_needs_owner" })
        expect(planMove("lost", "proposal", null, SETTINGS, true)).toEqual({
            kind: "move",
            stage: "proposal",
            closedReason: null,
        })
    })

    it("lets anyone reopen a closed deal when the settings do not ask for approval", () => {
        const settings = { ...SETTINGS, reopenNeedsApproval: false }
        expect(planMove("won", "new", null, settings, false)).toMatchObject({ kind: "move", stage: "new" })
    })

    it("moves a deal to an open stage without a reason and keeps none", () => {
        expect(planMove("new", "qualified", "ignored", SETTINGS, false)).toEqual({
            kind: "move",
            stage: "qualified",
            closedReason: null,
        })
    })

    it("asks for a reason of at least the minimum when closing a deal", () => {
        expect(planMove("proposal", "won", null, SETTINGS, false)).toEqual({
            kind: "refused",
            reason: "reason_required",
        })
        expect(planMove("proposal", "lost", "x".repeat(MIN_REASON_CHARS - 1), SETTINGS, false)).toEqual({
            kind: "refused",
            reason: "reason_required",
        })
        expect(planMove("proposal", "lost", "   ab   ", SETTINGS, false)).toEqual({
            kind: "refused",
            reason: "reason_required",
        })
    })

    it("closes a deal with the trimmed reason", () => {
        expect(planMove("proposal", "won", "  paid in full  ", SETTINGS, false)).toEqual({
            kind: "move",
            stage: "won",
            closedReason: "paid in full",
        })
    })
})

describe("classifiedStage", () => {
    it("takes the stage the AI proposes for an open deal", () => {
        expect(classifiedStage("new", "proposal")).toBe("proposal")
    })

    it("keeps the stage when the AI proposes none", () => {
        expect(classifiedStage("qualified", null)).toBe("qualified")
    })

    it("never lets the AI win a deal", () => {
        expect(classifiedStage("proposal", "won")).toBe("proposal")
    })

    it("never reopens a closed deal", () => {
        expect(classifiedStage("won", "new")).toBe("won")
        expect(classifiedStage("lost", "proposal")).toBe("lost")
    })
})

describe("stageAfterConfirm", () => {
    it("wins an open or won deal", () => {
        expect(stageAfterConfirm("new")).toBe("won")
        expect(stageAfterConfirm("won")).toBe("won")
    })

    it("leaves a lost deal lost", () => {
        expect(stageAfterConfirm("lost")).toBe("lost")
    })
})
