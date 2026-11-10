import { Test } from "@nestjs/testing"
import { JOB_TICKS } from "./job-ticks.contracts"
import { OUTBOX_KEY_SEPARATOR, resumeKeyOf } from "./parked-job-resume.policy"

const SUBJECT = Symbol("parked-job-resume.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { resumeKeyOf } }],
    }).compile()
    return moduleRef.get<typeof import("./parked-job-resume.policy")>(SUBJECT)
}

/** The rule of `job_outbox_dedupe_key_check`: 1 to 300 characters holding a ':'. */
const outboxKeyValid = (key: string): boolean => key.length >= 1 && key.length <= 300 && key.includes(":")

describe("resumeKeyOf", () => {
    it("keys the hand-back of a job whose key is a bare uuid as a valid outbox key, one per resume", async () => {
        const { resumeKeyOf } = await buildSubject()
        const jobKey = "8d9193ac-f853-4573-9edc-9da84949106f"
        expect(resumeKeyOf(jobKey, 1)).toBe(`${jobKey}:r1`)
        expect(outboxKeyValid(resumeKeyOf(jobKey, 1))).toBe(true)
        expect(resumeKeyOf(jobKey, 2)).not.toBe(resumeKeyOf(jobKey, 1))
    })
})

describe("the outbox keys of the ticks", () => {
    it("are valid for every tick at any minute, as JobTickService writes them", () => {
        for (const tick of JOB_TICKS) {
            expect(
                outboxKeyValid(`tick${OUTBOX_KEY_SEPARATOR}${tick.name}${OUTBOX_KEY_SEPARATOR}2026-11-09T10:15`),
            ).toBe(true)
        }
    })
})
