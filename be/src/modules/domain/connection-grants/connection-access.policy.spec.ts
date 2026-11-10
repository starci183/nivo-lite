import { Test } from "@nestjs/testing"
import {
    isDataProvider as realIsDataProvider,
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
                    isDataProvider: realIsDataProvider,
                    planExactly: realPlanExactly,
                    purposeFor: realPurposeFor,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<{
        isDataProvider: typeof realIsDataProvider
        planExactly: typeof realPlanExactly
        purposeFor: typeof realPurposeFor
    }>(SUBJECT)
    return subject
}

describe("connection access policy", () => {
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

    describe("planExactly", () => {
        it("binds every wanted id and removes every current id that is not wanted", async () => {
            const subject = await buildSubject()

            expect(subject.planExactly(new Set(["a", "gone"]), ["a", "new"])).toEqual([
                { id: "a", bound: true },
                { id: "new", bound: true },
                { id: "gone", bound: false },
            ])
        })

        it("removes everything when nothing is wanted", async () => {
            const subject = await buildSubject()

            expect(subject.planExactly(new Set(["a"]), [])).toEqual([{ id: "a", bound: false }])
        })
    })
})
