import {
    ACCESS_LEVELS,
    DEFAULT_ACCESS,
    isAccess,
    isDataProvider,
    normaliseAccess,
    planExactly,
    purposeFor,
} from "./connection-access.policy"

describe("connection access policy", () => {
    it("knows the three levels and starts a grant at ask", () => {
        expect(ACCESS_LEVELS).toEqual(["read", "ask", "auto"])
        expect(DEFAULT_ACCESS).toBe("ask")
        expect(isAccess("auto")).toBe(true)
        expect(isAccess("read")).toBe(true)
        expect(isAccess("ask")).toBe(true)
        expect(isAccess("root")).toBe(false)
    })

    describe("purposeFor", () => {
        it.each([
            ["chatbot", "telegram", "inbound_chat"],
            ["loyalty", "meta", "inbound_chat"],
            ["sales", "meta", "lead_source"],
            ["shifts", "zalo_oa", "outbound_chat"],
            ["accounting", "casso", "bank_feed"],
            ["chatbot", "database", "data_source"],
            ["booking", "imap", "data_source"],
            ["sales", "openapi", "tool"],
        ])("%s on %s is %s", (module, provider, purpose) => {
            expect(purposeFor(module, provider)).toBe(purpose)
        })

        it("answers null for a pair that cannot be granted", () => {
            expect(purposeFor("shifts", "sepay")).toBeNull()
            expect(purposeFor("constructor", "x")).toBeNull()
        })
    })

    it("tells data providers from the others", () => {
        expect(isDataProvider("database")).toBe(true)
        expect(isDataProvider("telegram")).toBe(false)
    })

    it("normalises null to remove, a level to itself and anything else to the default", () => {
        expect(normaliseAccess(null)).toBeNull()
        expect(normaliseAccess("auto")).toBe("auto")
        expect(normaliseAccess("nonsense")).toBe("ask")
        expect(normaliseAccess(undefined)).toBe("ask")
    })

    describe("planExactly", () => {
        it("keeps a current level, starts new ones at the default, honours a given level and removes the rest", () => {
            const current = new Map<string, "read" | "ask" | "auto">([
                ["a", "auto"],
                ["b", "read"],
                ["gone", "ask"],
            ])

            expect(planExactly(current, [{ id: "a" }, { id: "b", access: "ask" }, { id: "new" }])).toEqual([
                { id: "a", access: "auto" },
                { id: "b", access: "ask" },
                { id: "new", access: "ask" },
                { id: "gone", access: null },
            ])
        })

        it("removes everything when nothing is wanted", () => {
            expect(planExactly(new Map([["a", "read"]]), [])).toEqual([{ id: "a", access: null }])
        })
    })
})
