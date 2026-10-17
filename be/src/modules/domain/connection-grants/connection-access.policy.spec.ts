import { Test } from "@nestjs/testing"
import {
    ACCESS_LEVELS,
    DEFAULT_ACCESS,
    isAccess as realIsAccess,
    isDataProvider as realIsDataProvider,
    normaliseAccess as realNormaliseAccess,
    planExactly as realPlanExactly,
    purposeFor as realPurposeFor,
} from "./connection-access.policy"

const SUBJECT = Symbol("connection-access.policy")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isAccess: realIsAccess,
                    isDataProvider: realIsDataProvider,
                    normaliseAccess: realNormaliseAccess,
                    planExactly: realPlanExactly,
                    purposeFor: realPurposeFor,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<{
        isAccess: typeof realIsAccess
        isDataProvider: typeof realIsDataProvider
        normaliseAccess: typeof realNormaliseAccess
        planExactly: typeof realPlanExactly
        purposeFor: typeof realPurposeFor
    }>(SUBJECT)
    return subject
}

describe("connection access policy", () => {
    it("knows the three levels and starts a grant at ask", async () => {
        const subject = await buildSubject()

        expect(ACCESS_LEVELS).toEqual(["read", "ask", "auto"])
        expect(DEFAULT_ACCESS).toBe("ask")
        expect(subject.isAccess("auto")).toBe(true)
        expect(subject.isAccess("read")).toBe(true)
        expect(subject.isAccess("ask")).toBe(true)
        expect(subject.isAccess("root")).toBe(false)
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
        ])("%s on %s is %s", async (module, provider, purpose) => {
            const subject = await buildSubject()

            expect(subject.purposeFor(module, provider)).toBe(purpose)
        })

        it("answers null for a pair that cannot be granted", async () => {
            const subject = await buildSubject()

            expect(subject.purposeFor("shifts", "sepay")).toBeNull()
            expect(subject.purposeFor("constructor", "x")).toBeNull()
        })
    })

    it("tells data providers from the others", async () => {
        const subject = await buildSubject()

        expect(subject.isDataProvider("database")).toBe(true)
        expect(subject.isDataProvider("telegram")).toBe(false)
    })

    it("normalises null to remove, a level to itself and anything else to the default", async () => {
        const subject = await buildSubject()

        expect(subject.normaliseAccess(null)).toBeNull()
        expect(subject.normaliseAccess("auto")).toBe("auto")
        expect(subject.normaliseAccess("nonsense")).toBe("ask")
        expect(subject.normaliseAccess(undefined)).toBe("ask")
    })

    describe("planExactly", () => {
        it("keeps a current level, starts new ones at the default, honours a given level and removes the rest", async () => {
            const subject = await buildSubject()

            const current = new Map<string, "read" | "ask" | "auto">([
                ["a", "auto"],
                ["b", "read"],
                ["gone", "ask"],
            ])

            expect(subject.planExactly(current, [{ id: "a" }, { id: "b", access: "ask" }, { id: "new" }])).toEqual([
                { id: "a", access: "auto" },
                { id: "b", access: "ask" },
                { id: "new", access: "ask" },
                { id: "gone", access: null },
            ])
        })

        it("removes everything when nothing is wanted", async () => {
            const subject = await buildSubject()

            expect(subject.planExactly(new Map([["a", "read"]]), [])).toEqual([{ id: "a", access: null }])
        })
    })
})
