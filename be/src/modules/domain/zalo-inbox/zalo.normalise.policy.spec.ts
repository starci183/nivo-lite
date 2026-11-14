import { Test } from "@nestjs/testing"
import { schemaOf } from "@modules/domain/account-data"
import { ZALO_DATA_TYPES, zaloEvent, zaloUser } from "./zalo.data-types"
import {
    mergedZaloUserOf as realMergedZaloUserOf,
    zaloDerivedRowsOf as realZaloDerivedRowsOf,
    zaloEventRowsOf as realZaloEventRowsOf,
    zaloRawOf as realZaloRawOf,
} from "./zalo.normalise.policy"

const SUBJECT = Symbol("zalo.normalise.policy")
type Subject = {
    mergedZaloUserOf: typeof realMergedZaloUserOf
    zaloDerivedRowsOf: typeof realZaloDerivedRowsOf
    zaloEventRowsOf: typeof realZaloEventRowsOf
    zaloRawOf: typeof realZaloRawOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    mergedZaloUserOf: realMergedZaloUserOf,
                    zaloDerivedRowsOf: realZaloDerivedRowsOf,
                    zaloEventRowsOf: realZaloEventRowsOf,
                    zaloRawOf: realZaloRawOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = new Date("2026-11-12T08:00:00.000Z")
const bytes = (value: unknown): Buffer => Buffer.from(JSON.stringify(value))

/** A real-shaped Zalo OA webhook body of a customer picture. */
const picture = {
    app_id: "3601233",
    user_id_by_app: "552177279717587730",
    event_name: "user_send_image",
    timestamp: "1762192200000",
    sender: { id: "246845883529197922" },
    recipient: { id: "579745863508352884" },
    message: {
        msg_id: "96d3cdf3af150460909",
        text: "This one",
        attachments: [{ type: "image", payload: { url: "https://zalo.test/a.jpg", thumbnail: "https://zalo.test/t.jpg" } }],
    },
}

/** The declaration of a row's type. */
const declarationOf = (type: string) => ZALO_DATA_TYPES.find((def) => def.name === type)

/** True when every row fits the fields its type declares. */
const fitsDeclarations = (rows: ReadonlyArray<{ readonly type: string; readonly value: object }>): boolean =>
    rows.every((row) => {
        const def = declarationOf(row.type)
        return def !== undefined && schemaOf(def).safeParse(row.value).success
    })

describe("Zalo data types", () => {
    it("declares the event, the message and the person of a Zalo OA connection", () => {
        expect(ZALO_DATA_TYPES.map((def) => [def.name, def.write, def.retention, def.wakes])).toEqual([
            ["zalo_oa.event", "append", { days: 30 }, true],
            ["zalo_oa.message", "append", "keep", false],
            ["zalo_oa.user", "overwrite", "keep", false],
        ])
        expect(zaloUser.indexes).toEqual([{ name: "followed", on: ["followed"] }])
        expect(ZALO_DATA_TYPES.every((def) => def.provider === "zalo_oa" && (def.secretFields ?? []).includes("oa_secret_key"))).toBe(true)
    })
})

describe("zaloEventRowsOf", () => {
    it("keeps the body untouched in raw, keyed by the message id, its exact event name beside it, and fits its declaration", async () => {
        const subject = await buildSubject()
        const rows = subject.zaloEventRowsOf(bytes(picture))

        expect(rows).toEqual([
            { type: "zalo_oa.event", value: { eventId: "96d3cdf3af150460909", event: "user_send_image", raw: picture } },
        ])
        expect(schemaOf(zaloEvent).safeParse(rows[0]?.value).success).toBe(true)
    })

    it("names the door of a polled event, and keeps a body that is no JSON object as its text under the digest of its bytes", async () => {
        const subject = await buildSubject()
        const [polled] = subject.zaloEventRowsOf(bytes(picture), "poll")
        const [plain] = subject.zaloEventRowsOf(Buffer.from("not json"))

        expect(polled?.value).toMatchObject({ source: "poll" })
        expect(plain?.value).toMatchObject({ raw: { text: "not json" } })
        expect(JSON.stringify(plain?.value)).toMatch(/"eventId":"raw:[0-9a-f]{64}"/u)
        expect(fitsDeclarations([...(polled === undefined ? [] : [polled]), ...(plain === undefined ? [] : [plain])])).toBe(true)
    })
})

describe("zaloDerivedRowsOf", () => {
    it("keeps the message and the person of a customer picture, and the rows fit their declarations", async () => {
        const subject = await buildSubject()
        const rows = subject.zaloDerivedRowsOf(picture, NOW)

        expect(rows).toEqual([
            {
                type: "zalo_oa.message",
                value: {
                    msgId: "96d3cdf3af150460909",
                    userId: "246845883529197922",
                    direction: "in",
                    text: "This one",
                    at: new Date(1_762_192_200_000).toISOString(),
                },
            },
            { type: "zalo_oa.user", value: { userId: "246845883529197922", lastEvent: "user_send_image" } },
        ])
        expect(fitsDeclarations(rows)).toBe(true)
    })

    it("keeps the follow state of a follow or an unfollow, the name when the caller knows it", async () => {
        const subject = await buildSubject()

        expect(subject.zaloDerivedRowsOf({ event_name: "follow", follower: { id: "u-9" } }, NOW, "Lan")).toEqual([
            { type: "zalo_oa.user", value: { userId: "u-9", name: "Lan", followed: true, lastEvent: "follow" } },
        ])
        expect(subject.zaloDerivedRowsOf({ event_name: "unfollow", sender: { id: "u-9" } }, NOW)).toEqual([
            { type: "zalo_oa.user", value: { userId: "u-9", followed: false, lastEvent: "unfollow" } },
        ])
    })

    it("dates a message without time by now, and keeps nothing of another event or a message without sender or id", async () => {
        const subject = await buildSubject()
        const [message] = subject.zaloDerivedRowsOf({ ...picture, timestamp: undefined }, NOW)

        expect(message?.value).toMatchObject({ at: NOW.toISOString() })
        expect(subject.zaloDerivedRowsOf({ event_name: "user_seen_message", sender: { id: "u" } }, NOW)).toEqual([])
        expect(subject.zaloDerivedRowsOf({ ...picture, sender: {} }, NOW)).toEqual([])
        expect(subject.zaloDerivedRowsOf({ text: "not json" }, NOW)).toEqual([])
    })
})

describe("mergedZaloUserOf", () => {
    it("keeps a stored name and follow state the new event does not carry, and lets the new event win where it does", async () => {
        const subject = await buildSubject()
        const stored = { userId: "u", name: "Lan", followed: true, lastEvent: "follow" }

        expect(subject.mergedZaloUserOf(stored, { userId: "u", lastEvent: "user_send_text" })).toEqual({
            name: "Lan",
            followed: true,
            userId: "u",
            lastEvent: "user_send_text",
        })
        expect(subject.mergedZaloUserOf(stored, { userId: "u", followed: false, lastEvent: "unfollow" })).toMatchObject({ followed: false })
        expect(subject.mergedZaloUserOf(null, { userId: "u" })).toEqual({ userId: "u" })
    })
})
