import { Test } from "@nestjs/testing"
import { schemaOf } from "@modules/domain/account-data"
import { parseWebhook } from "@modules/integrations/meta"
import { AT, comment, event, postback } from "@tests/fixtures/builders/meta-inbox.builder"
import { META_DATA_TYPES, metaEvent } from "./meta.data-types"
import { metaDerivedRowsOf, metaEventRowsOf } from "./meta.normalise.policy"

const SUBJECT = Symbol("meta.normalise.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { metaDerivedRowsOf, metaEventRowsOf } }],
    }).compile()
    return moduleRef.get<typeof import("./meta.normalise.policy")>(SUBJECT)
}

/** A real-shaped signed Page delivery of one direct message. */
const DELIVERY = {
    object: "page",
    entry: [
        {
            id: "104512345678901",
            time: 1_762_850_000_000,
            messaging: [
                {
                    sender: { id: "7712345678901234" },
                    recipient: { id: "104512345678901" },
                    timestamp: 1_762_850_000_000,
                    message: { mid: "m_AbCdEf123", text: "Any red roses left?" },
                },
            ],
        },
    ],
}

/** True when every row fits the fields its type declares. */
const fitsDeclarations = (rows: ReadonlyArray<{ readonly type: string; readonly value: object }>): boolean =>
    rows.every((row) => {
        const def = META_DATA_TYPES.find((entry) => entry.name === row.type)
        return def !== undefined && schemaOf(def).safeParse(row.value).success
    })

describe("Meta data types", () => {
    it("declares the event, the message and the person of a Meta connection", () => {
        expect(META_DATA_TYPES.map((def) => [def.name, def.write, def.retention, def.wakes])).toEqual([
            ["meta.event", "append", { days: 30 }, true],
            ["meta.message", "append", "keep", false],
            ["meta.user", "overwrite", "keep", false],
        ])
        expect(META_DATA_TYPES.every((def) => def.provider === "meta" && (def.secretFields ?? []).includes("access_token"))).toBe(true)
    })
})

describe("metaEventRowsOf", () => {
    it("keeps the normalised event untouched in raw, keyed by its event_key, and a real parsed event fits its declaration", async () => {
        const subject = await buildSubject()
        const [parsed] = parseWebhook(DELIVERY, Date.parse(AT))
        const rows = parsed === undefined ? [] : subject.metaEventRowsOf(parsed)

        expect(rows).toEqual([{ type: "meta.event", value: { eventKey: parsed?.event_key, raw: parsed } }])
        expect(rows.every((row) => schemaOf(metaEvent).safeParse(row.value).success)).toBe(true)
    })
})

describe("metaDerivedRowsOf", () => {
    it("keeps the message and the person of a direct message, and both fit their declarations", async () => {
        const subject = await buildSubject()
        const rows = subject.metaDerivedRowsOf(event())

        expect(rows).toEqual([
            {
                type: "meta.message",
                value: {
                    eventKey: "dm:message-1",
                    mid: "message-1",
                    platform: "facebook",
                    userId: "person-1",
                    direction: "in",
                    text: "Hello",
                    at: AT,
                },
            },
            { type: "meta.user", value: { userId: "person-1", platform: "facebook", name: "Lan" } },
        ])
        expect(fitsDeclarations(rows)).toBe(true)
    })

    it("keeps only the person of a postback or a text-less message, and nothing of a comment or a nameless sender", async () => {
        const subject = await buildSubject()

        expect(subject.metaDerivedRowsOf(postback)).toEqual([
            { type: "meta.user", value: { userId: "ig-person-1", platform: "instagram" } },
        ])
        expect(subject.metaDerivedRowsOf(event({ text: "" })).map((row) => row.type)).toEqual(["meta.user"])
        expect(subject.metaDerivedRowsOf(event({ text: null, mid: null })).map((row) => row.type)).toEqual(["meta.user"])
        expect(subject.metaDerivedRowsOf(comment)).toEqual([])
        expect(subject.metaDerivedRowsOf(event({ kind: "leadgen" }))).toEqual([])
        expect(subject.metaDerivedRowsOf(event({ sender_psid: null, sender_igsid: null }))).toEqual([])
    })
})
