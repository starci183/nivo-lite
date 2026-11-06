import { Test } from "@nestjs/testing"
import {
    PROFILE_BATCH,
    PROFILE_MAX_AGE_MS,
    PROFILE_RETRY_MS,
    profileCuts,
    profileOfAnswer,
} from "./zalo-profile.policy"

/** The policy as one provider, read through the Nest testing module. */
class ProfilePolicySubject {
    readonly PROFILE_BATCH = PROFILE_BATCH
    readonly PROFILE_MAX_AGE_MS = PROFILE_MAX_AGE_MS
    readonly PROFILE_RETRY_MS = PROFILE_RETRY_MS
    readonly profileCuts = profileCuts
    readonly profileOfAnswer = profileOfAnswer
}

const build = async (): Promise<ProfilePolicySubject> => {
    const moduleRef = await Test.createTestingModule({ providers: [ProfilePolicySubject] }).compile()
    return moduleRef.get(ProfilePolicySubject)
}

describe("the rules of a profile round", () => {
    it("reads a profile again after a week, retries a failure after an hour and reads a few customers of a connection a round", async () => {
        const subject = await build()

        expect(subject.PROFILE_MAX_AGE_MS).toBe(7 * 24 * 3_600_000)
        expect(subject.PROFILE_RETRY_MS).toBe(3_600_000)
        expect(subject.PROFILE_BATCH).toBe(10)
    })

    it("cuts the moments a round asks the conversations about from now", async () => {
        const subject = await build()

        expect(subject.profileCuts(new Date("2026-11-07T10:00:00.000Z"))).toEqual({
            refreshedBefore: new Date("2026-10-31T10:00:00.000Z"),
            triedBefore: new Date("2026-11-07T09:00:00.000Z"),
        })
    })
})

describe("profileOfAnswer", () => {
    it("reads the name and the picture an answer holds", async () => {
        const subject = await build()

        expect(subject.profileOfAnswer({ name: "Minh", avatarUrl: "https://zalo.test/a.png" })).toEqual({
            name: "Minh",
            avatarUrl: "https://zalo.test/a.png",
        })
        expect(subject.profileOfAnswer({ name: "", avatarUrl: "" })).toEqual({ name: "", avatarUrl: "" })
    })

    it("answers null for anything that is not the name and picture", async () => {
        const subject = await build()

        expect(subject.profileOfAnswer(null)).toBeNull()
        expect(subject.profileOfAnswer("Minh")).toBeNull()
        expect(subject.profileOfAnswer({ name: "Minh" })).toBeNull()
        expect(subject.profileOfAnswer({ name: 1, avatarUrl: "" })).toBeNull()
    })
})
