import { Test } from "@nestjs/testing"
import { baseStaffHandle, staffHandles } from "./staff-handles.policy"

const SUBJECT = Symbol("staff-handles.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { baseStaffHandle, staffHandles } }],
    }).compile()
    return moduleRef.get<typeof import("./staff-handles.policy")>(SUBJECT)
}

describe("baseStaffHandle", () => {
    it.each([
        ["Ch\u1ECB H\u00E0", "ha"],
        ["Nguy\u1EC5n V\u0103n Minh", "minh"],
        ["\u0110\u1EE9c (ca s\u00E1ng)", "duc"],
        ["Anh", "anh"],
        ["", "staff"],
        ["  \t\n ", "staff"],
        ["(ca sang) ---", "staff"],
        ["\u0301\u2603", "staff"],
        ["Anh Ch\u1ECB Em", "em"],
        ["0123456789abcdefg", "0123456789abcdef"],
    ])("calls %p @%s", async (name, handle) => {
        const subject = await build()

        expect(subject.baseStaffHandle(name)).toBe(handle)
    })
})

describe("staffHandles", () => {
    it("reserves NIVO by default and advances past reserved numeric suffixes", async () => {
        const subject = await build()

        expect([...subject.staffHandles([{ id: "n", name: "NIVO" }])]).toEqual([["n", "nivo2"]])
        expect([
            ...subject.staffHandles(
                [
                    { id: "a", name: "abcdefghijklmnopq" },
                    { id: "b", name: "abcdefghijklmnopr" },
                ],
                ["ABCDEFGHIJKLMNOP", "abcdefghijklmnop2"],
            ),
        ]).toEqual([
            ["a", "abcdefghijklmnop3"],
            ["b", "abcdefghijklmnop4"],
        ])
        expect([...subject.staffHandles([])]).toEqual([])
    })

    it("numbers a repeated name and keeps clear of the reserved handles", async () => {
        const subject = await build()

        const handles = subject.staffHandles(
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
