import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { GuideAsk, GuideWords } from "./ai-generations.contracts"
import {
    GUIDE_HISTORY_TURNS,
    GUIDE_PATH_MAX,
    GUIDE_QUESTION_MAX,
    GUIDE_TURN_MAX,
    guideAskerKey,
    guidePrompt,
} from "./guide.policy"

const SUBJECT = Symbol("guide.policy")
type Subject = {
    guideAskerKey: typeof guideAskerKey
    guidePrompt: typeof guidePrompt
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { guideAskerKey, guidePrompt } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const askOf = builder<GuideAsk>({
    workspaceId: "w1",
    question: "How do I invite staff?",
    path: "/leads/42",
    history: [],
    locale: "en",
})
const WORDS: GuideWords = { text: (key) => `[${key}]` }

const userLine = (subject: Subject, ask: GuideAsk, isManager: boolean): string =>
    subject.guidePrompt(ask, isManager, WORDS)[1]?.content ?? ""

describe("guidePrompt", () => {
    it("lists the manager-only pages to a manager and hides them from staff", async () => {
        const subject = await buildSubject()
        expect(userLine(subject, askOf(), true)).toContain("- billing |")
        expect(userLine(subject, askOf(), false)).not.toContain("- billing |")
        expect(userLine(subject, askOf(), false)).toContain("- leads |")
    })

    it("names the page the member is on, by the longest matching path", async () => {
        const subject = await buildSubject()
        expect(userLine(subject, askOf(), false)).toContain("CURRENT PAGE: leads ([guide.page.leads.title])")
        expect(userLine(subject, askOf({ path: "/nowhere" }), false)).toContain("CURRENT PAGE: /nowhere")
    })

    it("keeps only the last turns and bounds the question", async () => {
        const subject = await buildSubject()
        const history = Array.from({ length: 10 }, (_, index) => ({ role: "user" as const, text: `turn ${index}` }))
        const line = userLine(subject, askOf({ history, question: "x".repeat(GUIDE_QUESTION_MAX + 50) }), true)

        expect(line).not.toContain("turn 3")
        expect(line).toContain(`turn ${10 - 1}`)
        expect(line.split("User: turn").length - 1).toBe(GUIDE_HISTORY_TURNS)
        expect(line).toContain(`QUESTION: ${"x".repeat(GUIDE_QUESTION_MAX)}`)
        expect(line).not.toContain("x".repeat(GUIDE_QUESTION_MAX + 1))
    })

    it("tells the model who is asking and how to reply", async () => {
        const subject = await buildSubject()
        const [system] = subject.guidePrompt(askOf(), false, WORDS)

        expect(system?.role).toBe("system")
        expect(system?.content).toContain("[guide.audienceStaff]")
        expect(system?.content).toContain("[guide.replyFormat]")
    })

    it("labels guide turns and clips only history longer than the turn limit", async () => {
        const subject = await buildSubject()
        const bounded = "u".repeat(GUIDE_TURN_MAX)
        const long = `${"g".repeat(GUIDE_TURN_MAX - 2)} ${"x".repeat(10)}`
        const line = userLine(
            subject,
            askOf({
                history: [
                    { role: "user", text: bounded },
                    { role: "guide", text: long },
                ],
                question: "  Where next?  ",
            }),
            false,
        )

        expect(line.split("CONVERSATION SO FAR:\n")[1]).toBe(
            `User: ${bounded}\nGuide: ${"g".repeat(GUIDE_TURN_MAX - 2)}...\n\nQUESTION: Where next?`,
        )
    })

    it("bounds an unknown current path and omits the empty conversation", async () => {
        const subject = await buildSubject()
        const path = `/${"x".repeat(GUIDE_PATH_MAX + 20)}`
        const line = userLine(subject, askOf({ path, question: "  Help  " }), false)

        expect(line.split("CURRENT PAGE: ")[1]).toBe(`${path.slice(0, GUIDE_PATH_MAX)}\n\nQUESTION: Help`)
        expect(line).not.toContain("CONVERSATION SO FAR")
    })
})

describe("guidePrompt", () => {
    it("identifies an exact connection page and gives managers the full system instructions", async () => {
        const subject = await buildSubject()
        const [system, user] = subject.guidePrompt(askOf({ path: "/connections" }), true, WORDS)

        expect(system).toEqual({
            role: "system",
            content: [
                "[guide.systemIntro]",
                "[guide.systemStyle]",
                "[guide.rulesTitle]",
                "[guide.rules]",
                "- [guide.audienceManager]",
                "[guide.replyFormat]",
            ].join("\n"),
        })
        expect(user?.role).toBe("user")
        expect(user?.content).toContain("CURRENT PAGE: connections ([guide.page.connections.title])")
        expect(user?.content).toContain(
            "- connections.sepay | [guide.page.connections.sepay.title] | [guide.page.connections.sepay.what] " +
                "| [guide.page.connections.sepay.how]",
        )
    })
})

describe("guideAskerKey", () => {
    it("names the member of the workspace", async () => {
        const subject = await buildSubject()
        expect(subject.guideAskerKey("w1", "u1")).toBe("guide:w1:u1")
    })
})
