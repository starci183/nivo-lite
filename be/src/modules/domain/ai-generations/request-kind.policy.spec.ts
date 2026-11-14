import { Test } from "@nestjs/testing"
import { INSTALLED } from "@modules/domain/installed-plugins"
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
        ["setup", "setup", true],
        ["other", "guide", false],
        ["office", "guide", false],
        ["unknown", "engine", false],
        ["constructor", "engine", false],
    ])("module %s asking for kind %s -> %s", async (module, kind, expected) => {
        const { subject } = await buildSubject()

        expect(subject.isRequestableKind(module, kind)).toBe(expected)
    })

    it.each([
        ["brain", "brain"],
        ["knowledge", "engine"],
        ["office", "owner_chat"],
        ["office", "office_command"],
        ["other", "engine"],
    ])("allows module %s to request its own kind %s", async (module, kind) => {
        const { subject } = await buildSubject()

        expect(subject.isRequestableKind(module, kind)).toBe(true)
    })

    it("allows every installed module its engine kind, and a customer-facing reply when its template's audience is customer", async () => {
        const { subject } = await buildSubject()

        for (const server of INSTALLED.servers()) {
            expect(subject.isRequestableKind(server.key, "engine")).toBe(true)
            expect(subject.isRequestableKind(server.key, "chat_reply")).toBe(server.template.audience === "customer")
            expect(subject.isRequestableKind(server.key, "owner_chat")).toBe(false)
        }
    })

    it.each([
        ["toString", "engine"],
        ["__proto__", "engine"],
        ["brain", "engine"],
        ["setup", "engine"],
        ["office", "chat_reply"],
        ["office", "engine"],
        ["other", ""],
    ])("refuses module %s asking for foreign or absent kind %s", async (module, kind) => {
        const { subject } = await buildSubject()

        expect(subject.isRequestableKind(module, kind)).toBe(false)
    })
})
