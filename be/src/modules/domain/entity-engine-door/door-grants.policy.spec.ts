import { Test } from "@nestjs/testing"
import { isDoorTool } from "@nivo-lite/agent-sdk/mutation"
import * as policy from "./door-grants.policy"

/** The policy as one provider, read through the Nest testing module. */
class GrantsSubject {
    readonly DOOR_GRANTS = policy.DOOR_GRANTS
    readonly isDoorGranted = policy.isDoorGranted
    readonly NOT_GRANTED = policy.NOT_GRANTED
}

const build = async (): Promise<GrantsSubject> => {
    const moduleRef = await Test.createTestingModule({ providers: [GrantsSubject] }).compile()
    return moduleRef.get(GrantsSubject)
}

describe("door grants", () => {
    it("holds exactly the tools the flow F module jobs call", async () => {
        const subject = await build()
        expect([...subject.DOOR_GRANTS].sort()).toEqual([
            "chat.profile",
            "chat.send",
            "ledger.append",
            "ledger.status",
            "team-chat.post-approval",
            "team-chat.post-report",
        ])
    })

    it("grants those tools and denies every other, by default", async () => {
        const subject = await build()
        for (const tool of subject.DOOR_GRANTS) expect(subject.isDoorGranted(tool)).toBe(true)
        for (const tool of ["chat.zalo.send", "ledger.void", "ai.agent", "", "ai.agent.turn.x"])
            expect(subject.isDoorGranted(tool)).toBe(false)
    })

    it("names every granted tool in the door grammar, so the door never meets a granted name it cannot read", async () => {
        const subject = await build()
        for (const tool of subject.DOOR_GRANTS) expect(isDoorTool(tool)).toBe(true)
    })

    it("answers forbidden, not granted, for a tool it denies", async () => {
        const subject = await build()
        expect(subject.NOT_GRANTED).toEqual({ ok: false, reason: "forbidden", message: "not_granted" })
    })
})
