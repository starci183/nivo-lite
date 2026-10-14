import { baseHandleOf, foldText, handleAmong, isAdvisorRole } from "./staff-handle.policy"

describe("foldText", () => {
    it("lowercases, strips accents, \u0111, parentheses and extra spaces", () => {
        expect(foldText("  Ch\u1ecb H\u00e0 (k\u1ebf to\u00e1n)  ")).toBe("chi ha")
    })
})

describe("baseHandleOf", () => {
    it("uses the given name after the title", () => {
        expect(baseHandleOf("Ch\u1ecb H\u00e0")).toBe("ha")
        expect(baseHandleOf("Mr. John")).toBe("john")
    })

    it("keeps a title-only name and falls back when the name is empty", () => {
        expect(baseHandleOf("Anh")).toBe("anh")
        expect(baseHandleOf("   ")).toBe("staff")
    })

    it("stops a long given name at 16 characters", () => {
        expect(baseHandleOf("a".repeat(20))).toBe("a".repeat(16))
    })
})

describe("handleAmong", () => {
    const staff = [
        { id: "s1", name: "Ch\u1ecb H\u00e0" },
        { id: "s2", name: "Anh H\u00e0" },
        { id: "s3", name: "Nivo" },
        { id: "s4", name: "Nivo" },
    ]

    it("numbers a repeated given name and skips the reserved nivo handle", () => {
        expect(handleAmong(staff, "s1")).toBe("ha")
        expect(handleAmong(staff, "s2")).toBe("ha2")
        expect(handleAmong(staff, "s3")).toBe("nivo2")
        expect(handleAmong(staff, "s4")).toBe("nivo3")
    })

    it("answers staff when the id is not in the list", () => {
        expect(handleAmong(staff, "missing")).toBe("staff")
    })
})

describe("isAdvisorRole", () => {
    it.each([
        "T\u01b0 v\u1ea5n vi\u00ean",
        "Sales",
        "B\u00e1n h\u00e0ng",
        "Kinh doanh",
        "CSKH",
        "Ch\u0103m s\u00f3c kh\u00e1ch",
        "Advisor",
        "Consultant",
    ])("treats %s as an advisor", (role) => {
        expect(isAdvisorRole(role)).toBe(true)
    })

    it("does not treat accounting as an advisor", () => {
        expect(isAdvisorRole("K\u1ebf to\u00e1n")).toBe(false)
    })
})
