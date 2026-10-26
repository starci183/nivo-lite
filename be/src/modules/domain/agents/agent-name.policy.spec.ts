import { Test } from "@nestjs/testing"
import { AGENT_DISPLAY_NAME_LIMITS, cleanAgentName, isAgentAvatarUrl } from "./agent-name.policy"

type Subject = {
    cleanAgentName: typeof cleanAgentName
    isAgentAvatarUrl: typeof isAgentAvatarUrl
}

const SUBJECT = Symbol("agent-name.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { cleanAgentName, isAgentAvatarUrl } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("agent name policy", () => {
    it("keeps any free-text name, trimmed and with whitespace folded, and never reads a role out of it", async () => {
        const subject = await buildSubject()

        expect(subject.cleanAgentName("  Thao   Van Mkt ")).toBe("Thao Van Mkt")
        expect(subject.cleanAgentName("Cat")).toBe("Cat")
        expect(subject.cleanAgentName("ab")).toBe("ab")
        expect(subject.cleanAgentName("z".repeat(AGENT_DISPLAY_NAME_LIMITS.max))).toHaveLength(40)
    })

    it("refuses a name shorter or longer than the limits", async () => {
        const subject = await buildSubject()

        expect(subject.cleanAgentName("")).toBeNull()
        expect(subject.cleanAgentName("   a  ")).toBeNull()
        expect(subject.cleanAgentName("z".repeat(AGENT_DISPLAY_NAME_LIMITS.max + 1))).toBeNull()
    })

    it("accepts only HTTPS picture addresses within the length the table allows", async () => {
        const subject = await buildSubject()

        expect(subject.isAgentAvatarUrl("https://cdn.example/a.png")).toBe(true)
        expect(subject.isAgentAvatarUrl("http://cdn.example/a.png")).toBe(false)
        expect(subject.isAgentAvatarUrl("javascript:alert(1)")).toBe(false)
        expect(subject.isAgentAvatarUrl("https://cdn.example/a b.png")).toBe(false)
        expect(subject.isAgentAvatarUrl(`https://cdn.example/${"a".repeat(2048)}`)).toBe(false)
    })
})
