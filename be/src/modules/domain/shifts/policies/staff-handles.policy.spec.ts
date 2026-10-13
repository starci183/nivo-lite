import { baseStaffHandle, staffHandles } from "./staff-handles.policy"

describe("baseStaffHandle", () => {
    it.each([
        ["Ch\u1ECB H\u00E0", "ha"],
        ["Nguy\u1EC5n V\u0103n Minh", "minh"],
        ["\u0110\u1EE9c (ca s\u00E1ng)", "duc"],
        ["Anh", "anh"],
        ["", "staff"],
    ])("calls %p @%s", (name, handle) => {
        expect(baseStaffHandle(name)).toBe(handle)
    })
})

describe("staffHandles", () => {
    it("numbers a repeated name and keeps clear of the reserved handles", () => {
        const handles = staffHandles(
            [
                { id: "a", name: "Ch\u1ECB H\u00E0" },
                { id: "b", name: "H\u00E0" },
                { id: "c", name: "Sales" },
            ],
            ["Sales"],
        )

        expect([...handles]).toEqual([
            ["a", "ha"],
            ["b", "ha2"],
            ["c", "sales2"],
        ])
    })
})
