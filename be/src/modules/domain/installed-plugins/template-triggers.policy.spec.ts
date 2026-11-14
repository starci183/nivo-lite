import { Test } from "@nestjs/testing"
import { PROVIDER, TRIGGER, type TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { sourcesOfVerb, wakeOfSource } from "./template-triggers.policy"

const SUBJECT = Symbol("template-triggers.policy")

const build = async (): Promise<{ sourcesOfVerb: typeof sourcesOfVerb; wakeOfSource: typeof wakeOfSource }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { sourcesOfVerb, wakeOfSource } }],
    }).compile()
    return moduleRef.get(SUBJECT)
}

/** The Meta verb of Facebook, written out. */
const FACEBOOK: TriggerVerb = TRIGGER.facebookMessageReceived

describe("the sources of today of a @2 trigger, from the trigger registry", () => {
    it("derives each channel's own source for its provider, and the road it arrives on", async () => {
        const subject = await build()
        // Ledger (owner key triggerOneSource2026_11_12, CORRECTED 2026-11-12): the trigger lists its providers again (`accounts`).
        expect(subject.sourcesOfVerb(TRIGGER.zaloMessageReceived, [PROVIDER.zaloOa])).toEqual([{ kind: "zalo", connectionId: null }])
        expect(subject.sourcesOfVerb(FACEBOOK, [PROVIDER.meta])).toEqual([{ kind: "facebook", connectionId: null }])
        expect(subject.wakeOfSource({ kind: "facebook", connectionId: null })).toBe("channel")
    })

    it("gives every source of today the road its wakes arrive on, from the registry", async () => {
        const subject = await build()
        expect(subject.wakeOfSource({ kind: "zalo", connectionId: null })).toBe("channel")
        expect(subject.wakeOfSource({ kind: "schedule", connectionId: null })).toBe("schedule")
        expect(subject.wakeOfSource({ kind: "chats-group", connectionId: null })).toBe("chats-group")
        expect(subject.wakeOfSource({ kind: "workflow", connectionId: null })).toBe("agent")
        expect(subject.wakeOfSource({ kind: "provider", connectionId: null, provider: "imap", trigger: "mail.received" })).toBe(
            "system-event",
        )
    })
})
