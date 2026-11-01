import { Test } from "@nestjs/testing"
import {
    AGENT_DISPLAY_NAME_LIMITS,
    AGENT_SERIAL_RANGE,
    agentSerialOf,
    cleanAgentName,
    defaultAgentName,
    isAgentAvatarUrl,
} from "./agent-name.policy"

type Subject = {
    cleanAgentName: typeof cleanAgentName
    isAgentAvatarUrl: typeof isAgentAvatarUrl
    defaultAgentName: typeof defaultAgentName
    agentSerialOf: typeof agentSerialOf
}

const SUBJECT = Symbol("agent-name.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { cleanAgentName, isAgentAvatarUrl, defaultAgentName, agentSerialOf } },
        ],
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

    it("names a new agent by its role and generated id, with no person and no role suffix", async () => {
        const subject = await buildSubject()

        expect(subject.defaultAgentName("Chatbot", 23233)).toBe("Agent Chatbot #23233")
        expect(subject.defaultAgentName(" Sales ", 10000)).toBe("Agent Sales #10000")
    })

    it("takes the generated id from the tail of a UUID, inside the five-digit range at both ends", async () => {
        const subject = await buildSubject()

        expect(subject.agentSerialOf("00000000-0000-4000-8000-000000000000")).toBe(AGENT_SERIAL_RANGE.min)
        expect(subject.agentSerialOf("00000000-0000-4000-8000-000000000001")).toBe(AGENT_SERIAL_RANGE.min + 1)
        expect(subject.agentSerialOf("ffffffff-ffff-4fff-bfff-ffffffffffff")).toBe(
            AGENT_SERIAL_RANGE.min + (0xffffffff % 90_000),
        )
    })
})
