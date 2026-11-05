import {
    LEAD_STAGES,
    MIN_REASON_CHARS,
    OPEN_STAGES,
    canMove,
    classifiedStage,
    isLeadStage,
    isOpenStage,
    planMove,
    stageAfterConfirm,
} from "./stage"

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

    it("lets an open deal go to any other stage", () => {
        expect(canMove("new", "proposal")).toBe(true)
        expect(canMove("proposal", "new")).toBe(true)
        expect(canMove("qualified", "lost")).toBe(true)
    })

    it("lets a closed deal go only to the other closed outcome", () => {
        expect(canMove("won", "lost")).toBe(true)
        expect(canMove("lost", "won")).toBe(true)
        expect(canMove("won", "new")).toBe(false)
        expect(canMove("lost", "proposal")).toBe(false)
    })
})

describe("planMove", () => {
    it("refuses to move a deal to the stage it is in", () => {
        expect(planMove("new", "new", null)).toEqual({ kind: "refused", reason: "same_stage" })
    })

    it("refuses a move the flow does not allow", () => {
        expect(planMove("won", "new", null)).toEqual({ kind: "refused", reason: "stage_not_allowed" })
    })

    it("moves a deal to an open stage without a reason and keeps none", () => {
        expect(planMove("new", "qualified", "ignored")).toEqual({
            kind: "move",
            stage: "qualified",
            closedReason: null,
        })
    })

    it("asks for a reason of at least the minimum when closing a deal", () => {
        expect(planMove("proposal", "won", null)).toEqual({ kind: "refused", reason: "reason_required" })
        expect(planMove("proposal", "lost", "x".repeat(MIN_REASON_CHARS - 1))).toEqual({
            kind: "refused",
            reason: "reason_required",
        })
        expect(planMove("proposal", "lost", "   ab   ")).toEqual({ kind: "refused", reason: "reason_required" })
    })

    it("closes a deal with the trimmed reason", () => {
        expect(planMove("proposal", "won", "  paid in full  ")).toEqual({
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
