import { Test } from "@nestjs/testing"
import {
    BACKGROUND_STOPPED_MESSAGE_KIND,
    backgroundStoppedCardViewOf,
    backgroundStoppedKeyOf,
    backgroundStoppedMessageOf,
    backgroundStoppedPayloadOf,
    storedBackgroundStoppedOf,
} from "./background-stop-card.policy"
import { isNivoRoomKey, nivoRoomKeyOf } from "./team-chat.policy"

const SUBJECT = Symbol("background-stop-card.policy")

/** The policy as the providers of a testing module hand it out. */
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    backgroundStoppedCardViewOf,
                    backgroundStoppedKeyOf,
                    backgroundStoppedMessageOf,
                    backgroundStoppedPayloadOf,
                    storedBackgroundStoppedOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./background-stop-card.policy")>(SUBJECT)
}

const NOW = new Date("2026-11-11T10:00:00.000Z")
const EPISODE = new Date("2026-11-11T09:58:00.000Z")
const PAYLOAD = backgroundStoppedPayloadOf({ work: "brain.policies.derive", reason: "credits", episode: EPISODE }, NOW)
const STORED = JSON.stringify(backgroundStoppedMessageOf(PAYLOAD))

describe("background-stop-card.policy", () => {
    it("the payload holds codes only: what, why, since, the episode and where to retry", async () => {
        const subject = await buildSubject()
        expect(subject.backgroundStoppedPayloadOf({ work: "brain.policies.derive", reason: "credits", episode: EPISODE }, NOW)).toEqual({
            version: 1,
            work: "brain.policies.derive",
            reason: "credits",
            since: "2026-11-11T10:00:00.000Z",
            episode: "2026-11-11T09:58:00.000Z",
            target: { kind: "brain.policies" },
        })
    })

    it("the message only tells: kind background.stopped, intent notify, no one-tap reply", async () => {
        const subject = await buildSubject()
        expect(subject.backgroundStoppedMessageOf(PAYLOAD)).toEqual({
            kind: BACKGROUND_STOPPED_MESSAGE_KIND,
            intent: "notify",
            title: "brain.policies.derive",
            summary: "brain.policies.derive · credits",
            payload: PAYLOAD,
            options: [],
        })
    })

    it("one key per work and episode, within the column's 64 characters", async () => {
        const subject = await buildSubject()
        const key = subject.backgroundStoppedKeyOf("brain.policies.derive", EPISODE)
        expect(key).toBe(`bg-stopped:brain.policies.derive:${String(EPISODE.getTime())}`)
        expect(key.length).toBeLessThanOrEqual(64)
        expect(subject.backgroundStoppedKeyOf("brain.policies.derive", new Date(EPISODE.getTime() + 1))).not.toBe(key)
    })

    it("reads a stored card back, and the view drops the shape version", async () => {
        const subject = await buildSubject()
        expect(subject.storedBackgroundStoppedOf(STORED)).toEqual(PAYLOAD)
        const { version: _shape, ...shown } = PAYLOAD
        expect(subject.backgroundStoppedCardViewOf(STORED)).toEqual(shown)
    })

    it.each([
        ["no line", null],
        ["text that is not JSON", "{oops"],
        ["another card kind", JSON.stringify({ kind: "brain.change", payload: PAYLOAD })],
        ["an unknown reason", JSON.stringify({ kind: "background.stopped", payload: { ...PAYLOAD, reason: "disk" } })],
        ["an unknown work", JSON.stringify({ kind: "background.stopped", payload: { ...PAYLOAD, work: "x.y" } })],
    ])("%s is no background.stopped card", async (_name, stored) => {
        const subject = await buildSubject()
        expect(subject.storedBackgroundStoppedOf(stored)).toBeNull()
        expect(subject.backgroundStoppedCardViewOf(stored)).toBeNull()
    })

    it("the NIVO room key is the sorted pair of NIVO and the person, and only it reads as a NIVO room", () => {
        expect(nivoRoomKeyOf("u-1")).toBe("system:nivo|user:u-1")
        expect(isNivoRoomKey("system:nivo|user:u-1")).toBe(true)
        expect(isNivoRoomKey("agent:a-1|user:u-1")).toBe(false)
        expect(isNivoRoomKey("user:u-1|user:u-2")).toBe(false)
        expect(isNivoRoomKey(null)).toBe(false)
    })
})
