import { Test } from "@nestjs/testing"
import { DEFAULT_ENGINE, THREAD_READY_WORKFLOWS, engineDefaultOf, threadFlagOf, threadWorkflowsOf } from "./thread-flag.policy"

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

    it("clears the nine blocks-core workflows for threads, and nothing else", () => {
        expect(THREAD_READY_WORKFLOWS).toEqual([
            "chatbot.front-desk",
            "sales.consult",
            "accounting.reconcile",
            "sales.after-sale",
            "sales.delivery-check",
            "sales.occasion",
            "sales.payment-reminder",
            "sales.web-order",
            "accounting.reports",
        ])
    })

    it("reads the phase-1 walk's flag", async () => {
        const subject = await build()

        expect(subject.threadFlagOf("chatbot.front-desk,sales.consult,accounting.reconcile")).toEqual({
            kind: "workflows",
            workflows: ["chatbot.front-desk", "sales.consult", "accounting.reconcile"],
        })
    })

    it.each(["sales.ghost", "accounting.main", "front-desk", "Chatbot.Front-Desk", "*"])(
        "names what is no workflow cleared for threads: %s",
        async (name) => {
            const subject = await build()

            expect(subject.threadFlagOf(`chatbot.front-desk,${name}`)).toEqual({ kind: "invalid", name })
        },
    )

    it("keeps the old engine as the default until it is switched", () => {
        expect(DEFAULT_ENGINE).toBe("legacy")
        expect(engineDefaultOf(undefined)).toEqual({ kind: "engine", engine: "legacy" })
        expect(engineDefaultOf("  ")).toEqual({ kind: "engine", engine: "legacy" })
    })

    it.each(["legacy", "langgraph", " langgraph "])("reads the default engine %p", (text) => {
        expect(engineDefaultOf(text)).toEqual({ kind: "engine", engine: text.trim() })
    })

    it.each(["LangGraph", "on", "threads", "*"])("names what is no engine: %s", (text) => {
        expect(engineDefaultOf(text)).toEqual({ kind: "invalid", name: text })
    })

    it("starts exactly the flag's workflows on threads with the old engine as default; an unset flag stays off", () => {
        expect(threadWorkflowsOf([], "legacy")).toEqual([])
        expect(threadWorkflowsOf(["sales.consult"], "legacy")).toEqual(["sales.consult"])
    })

    it("starts every cleared workflow on threads with LangGraph as default, the flag's names first and once", () => {
        expect(threadWorkflowsOf([], "langgraph")).toEqual(THREAD_READY_WORKFLOWS)
        expect(threadWorkflowsOf(["sales.web-order"], "langgraph")).toEqual([
            "sales.web-order",
            ...THREAD_READY_WORKFLOWS.filter((name) => name !== "sales.web-order"),
        ])
    })
})
