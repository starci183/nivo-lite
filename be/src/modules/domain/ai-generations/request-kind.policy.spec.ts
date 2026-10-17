import { Test } from "@nestjs/testing"
import { isRequestableKind } from "./request-kind.policy"

const SUBJECT = Symbol("request-kind.policy")
type Subject = {
    isRequestableKind: typeof isRequestableKind
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isRequestableKind } }],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)
    return { subject }
}

describe("isRequestableKind", () => {
    it.each([
        ["office", "relay", true],
        ["sales", "engine", true],
        ["setup", "setup", true],
        ["other", "guide", false],
        ["office", "guide", false],
        ["sales", "owner_chat", false],
        ["unknown", "engine", false],
        ["constructor", "engine", false],
    ])("module %s asking for kind %s -> %s", async (module, kind, expected) => {
        const { subject } = await buildSubject()

        expect(subject.isRequestableKind(module, kind)).toBe(expected)
    })

    it.each([
        ["accounting", "engine"],
        ["booking", "engine"],
        ["brain", "brain"],
        ["chatbot", "engine"],
        ["chatbot", "chat_reply"],
        ["content", "engine"],
        ["hiring", "engine"],
        ["inventory", "engine"],
        ["knowledge", "engine"],
        ["leadgen", "engine"],
        ["loyalty", "engine"],
        ["office", "owner_chat"],
        ["office", "office_command"],
        ["other", "engine"],
        ["shifts", "engine"],
        ["video", "engine"],
    ])("allows module %s to request its own kind %s", async (module, kind) => {
        const { subject } = await buildSubject()

        expect(subject.isRequestableKind(module, kind)).toBe(true)
    })

    it.each([
        ["toString", "engine"],
        ["__proto__", "engine"],
        ["brain", "engine"],
        ["setup", "engine"],
        ["office", "chat_reply"],
        ["chatbot", "relay"],
        ["other", ""],
    ])("refuses module %s asking for foreign or absent kind %s", async (module, kind) => {
        const { subject } = await buildSubject()

        expect(subject.isRequestableKind(module, kind)).toBe(false)
    })
})
