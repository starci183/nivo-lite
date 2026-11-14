import { BRANCH_MODE_MEMBER, LEGACY_BRANCH_MODE_MEMBER, branchModeRead } from "./branch-mode"

/** A branch as a version stored before the rename holds it, built from entries so that no object here is written with the legacy member. */
const legacyBranchOf = (mode: string): unknown =>
    Object.fromEntries([
        ["key", "small"],
        ["when", "else"],
        [LEGACY_BRANCH_MODE_MEMBER, mode],
        ["next", "act"],
    ])

/** The member names of a value, in order; none for a value that is no object. */
const memberNamesOf = (value: unknown): ReadonlyArray<string> =>
    typeof value === "object" && value !== null ? Object.keys(value) : []

describe("branchModeRead", () => {
    it("reads the legacy member as mode, every other member and the member order kept", () => {
        const read = branchModeRead(legacyBranchOf("ask"))
        expect(read).toEqual({ key: "small", when: "else", mode: "ask", next: "act" })
        expect(memberNamesOf(read)).toEqual(["key", "when", BRANCH_MODE_MEMBER, "next"])
    })

    it("hands back a branch that already holds mode, and a value that is no object, untouched", () => {
        const branch = { key: "small", when: "else", mode: "auto", next: "act" }
        expect(branchModeRead(branch)).toBe(branch)
        expect(branchModeRead("else")).toBe("else")
        expect(branchModeRead(null)).toBeNull()
        expect(branchModeRead([1])).toEqual([1])
    })

    it("leaves a branch that carries both members as it is, for the strict schema to refuse", () => {
        const both = Object.fromEntries([
            ["key", "small"],
            [LEGACY_BRANCH_MODE_MEMBER, "auto"],
            [BRANCH_MODE_MEMBER, "ask"],
        ])
        expect(branchModeRead(both)).toBe(both)
        expect(memberNamesOf(branchModeRead(both))).toEqual(["key", LEGACY_BRANCH_MODE_MEMBER, BRANCH_MODE_MEMBER])
    })

    it("does not change the stored value it read", () => {
        const stored = legacyBranchOf("stop")
        const before = JSON.stringify(stored)
        branchModeRead(stored)
        expect(JSON.stringify(stored)).toBe(before)
    })
})
