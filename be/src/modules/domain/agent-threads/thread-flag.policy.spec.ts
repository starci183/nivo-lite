import { Test } from "@nestjs/testing"
import { THREAD_READY_WORKFLOWS, threadFlagOf } from "./thread-flag.policy"

/** The members of the subject under test. */
interface Subject {
    readonly threadFlagOf: typeof threadFlagOf
}

const SUBJECT = Symbol("thread-flag.policy")

/** The policy, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { threadFlagOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("thread-flag.policy", () => {
    it.each([undefined, "", " , ", ","])("is off with no name in the flag: %p", async (text) => {
        const subject = await build()

        expect(subject.threadFlagOf(text)).toEqual({ kind: "workflows", workflows: [] })
    })

    it("reads the workflows the flag names, once each", async () => {
        const subject = await build()

        expect(subject.threadFlagOf(" chatbot.front-desk, chatbot.front-desk ")).toEqual({
            kind: "workflows",
            workflows: ["chatbot.front-desk"],
        })
    })

    it("clears the front desk alone for threads in phase 0", () => {
        expect(THREAD_READY_WORKFLOWS).toEqual(["chatbot.front-desk"])
    })

    it.each(["sales.consult", "accounting.reconcile", "front-desk", "Chatbot.Front-Desk", "*"])(
        "names what is no workflow cleared for threads: %s",
        async (name) => {
            const subject = await build()

            expect(subject.threadFlagOf(`chatbot.front-desk,${name}`)).toEqual({ kind: "invalid", name })
        },
    )
})
