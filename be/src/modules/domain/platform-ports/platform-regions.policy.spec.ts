import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GAPS_SHOWN, regionKey, toneOfStatus } from "./platform-regions.policy"

interface Subject {
    readonly toneOfStatus: typeof toneOfStatus
    readonly regionKey: typeof regionKey
    readonly gapsShown: number
}

const SUBJECT = Symbol("platform-regions.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<Subject>({ toneOfStatus, regionKey, gapsShown: GAPS_SHOWN }) }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("platform regions policy", () => {
    it("tones the badge of a connection by its status, neutral for one it does not know", async () => {
        const policy = await build()
        expect(policy.toneOfStatus("connected")).toBe("success")
        expect(policy.toneOfStatus("error")).toBe("danger")
        expect(policy.toneOfStatus("pending")).toBe("warning")
        expect(policy.toneOfStatus("disconnected")).toBe("neutral")
    })

    it("names the words of a region by group and value, and lists five gaps", async () => {
        const policy = await build()
        expect(policy.regionKey("status", "connected")).toBe("workbench.platform.status.connected")
        expect(policy.gapsShown).toBe(5)
    })
})
