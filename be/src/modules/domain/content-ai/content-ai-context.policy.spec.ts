import { Test } from "@nestjs/testing"
import {
    objectOf as realObjectOf,
    idsOf as realIdsOf,
    numeric as realNumeric,
    isBrandContext as realIsBrandContext,
    isContentMediaRef as realIsContentMediaRef,
    isPlannedSlot as realIsPlannedSlot,
    isChannelWarning as realIsChannelWarning,
} from "./content-ai-context.policy"

const SUBJECT = Symbol("content-ai-context.policy")

type Subject = Pick<
    typeof import("./content-ai-context.policy"),
    "objectOf" | "idsOf" | "numeric" | "isBrandContext" | "isContentMediaRef" | "isPlannedSlot" | "isChannelWarning"
>

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    objectOf: realObjectOf,
                    idsOf: realIdsOf,
                    numeric: realNumeric,
                    isBrandContext: realIsBrandContext,
                    isContentMediaRef: realIsContentMediaRef,
                    isPlannedSlot: realIsPlannedSlot,
                    isChannelWarning: realIsChannelWarning,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const BRAND = {
    shop: "Flower shop",
    knowledge: "Seasonal flowers",
    voice: "Warm",
    avoid: "Promises",
    audience: "Local customers",
    cta: "Visit us",
    sources: ["Public catalogue"],
    brandHashtags: ["#flowers"],
}

const PILLAR = { id: "pillar-1", name: "Flowers", description: "Seasonal bouquets", weight: 1, active: true }

const EVENT = { key: "occasion", date: "2026-10-20", name: "Occasion", angle: "Celebrate", leadDays: 2 }

const SLOT = {
    n: 1,
    at: "2026-10-20T03:00:00.000Z",
    channels: ["facebook", "zalo"],
    pillar: PILLAR,
    holiday: EVENT,
}

describe("stored content AI context", () => {
    it("retains an object without copying or changing its metadata", async () => {
        const subject = await build()

        const metadata = { rootId: "generation-1", nested: { value: 3 } }

        expect(subject.objectOf(metadata)).toBe(metadata)
        expect(metadata).toEqual({ rootId: "generation-1", nested: { value: 3 } })
    })
    it.each([undefined, null, [], "metadata", 5, false])(
        "replaces malformed metadata %p with an empty object",
        async (value) => {
            const subject = await build()

            expect(subject.objectOf(value)).toEqual({})
        },
    )
    it("preserves string generation ids in order, including duplicates and empty strings", async () => {
        const subject = await build()

        const generationIds = ["g-2", 3, null, "", "g-2", {}, "g-1", undefined]

        expect(subject.idsOf({ generationIds })).toEqual(["g-2", "", "g-2", "g-1"])
        expect(generationIds).toEqual(["g-2", 3, null, "", "g-2", {}, "g-1", undefined])
    })
    it.each([undefined, null, "g-1", {}, 1])(
        "returns no generation ids for non-array metadata %p",
        async (generationIds) => {
            const subject = await build()

            expect(subject.idsOf({ generationIds })).toEqual([])
        },
    )
    it.each([0, -4.5, 9, Number.MAX_VALUE])("retains finite number %p", async (value) => {
        const subject = await build()

        expect(subject.numeric(value)).toBe(value)
    })
    it.each([undefined, null, "4", false, {}, [], Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
        "rejects non-finite or non-numeric value %p",
        async (value) => {
            const subject = await build()

            expect(subject.numeric(value)).toBeNull()
        },
    )
    it("accepts complete brand context with populated or empty string lists", async () => {
        const subject = await build()

        expect(subject.isBrandContext(BRAND)).toBe(true)
        expect(subject.isBrandContext({ ...BRAND, sources: [], brandHashtags: [] })).toBe(true)
    })
})

describe("stored content AI context", () => {
    it.each([
        { label: "non-object", value: null },
        { label: "shop", value: { ...BRAND, shop: 1 } },
        { label: "knowledge", value: { ...BRAND, knowledge: null } },
        { label: "voice", value: { ...BRAND, voice: false } },
        { label: "avoid", value: { ...BRAND, avoid: [] } },
        { label: "audience", value: { ...BRAND, audience: {} } },
        { label: "cta", value: { ...BRAND, cta: undefined } },
        { label: "sources list", value: { ...BRAND, sources: "source" } },
        { label: "source entry", value: { ...BRAND, sources: ["source", 2] } },
        { label: "hashtags list", value: { ...BRAND, brandHashtags: null } },
        { label: "hashtag entry", value: { ...BRAND, brandHashtags: ["#flowers", false] } },
    ])("rejects malformed brand $label", async ({ value }) => {
        const subject = await build()

        expect(subject.isBrandContext(value)).toBe(false)
    })
    it("accepts media with omitted or correctly typed optional fields", async () => {
        const subject = await build()

        expect(subject.isContentMediaRef({ kind: "image", name: "bouquet.jpg" })).toBe(true)
        expect(
            subject.isContentMediaRef({
                kind: "video",
                name: "tour.mp4",
                path: "/media/tour.mp4",
                id: "media-1",
                suggested: false,
            }),
        ).toBe(true)
        expect(subject.isContentMediaRef({ kind: "image", name: "suggestion", suggested: true })).toBe(true)
    })
})

describe("stored content AI context", () => {
    it.each([
        { label: "non-object", value: [] },
        { label: "kind", value: { kind: 1, name: "bouquet.jpg" } },
        { label: "name", value: { kind: "image", name: null } },
        { label: "path", value: { kind: "image", name: "bouquet.jpg", path: null } },
        { label: "id", value: { kind: "image", name: "bouquet.jpg", id: 5 } },
        { label: "suggested", value: { kind: "image", name: "bouquet.jpg", suggested: "true" } },
    ])("rejects malformed media $label", async ({ value }) => {
        const subject = await build()

        expect(subject.isContentMediaRef(value)).toBe(false)
    })
    it("accepts planned slots with a valid event, no event, and an event without a preparation window", async () => {
        const subject = await build()

        expect(subject.isPlannedSlot(SLOT)).toBe(true)
        expect(subject.isPlannedSlot({ ...SLOT, holiday: null })).toBe(true)
        expect(
            subject.isPlannedSlot({
                ...SLOT,
                holiday: { key: "event", date: "2026-10-20", name: "Day", angle: "Story" },
            }),
        ).toBe(true)
        expect(subject.isPlannedSlot({ ...SLOT, channels: [], pillar: { ...PILLAR, weight: 0, active: false } })).toBe(
            true,
        )
    })
    it.each([
        { label: "non-object", value: undefined },
        { label: "slot number", value: { ...SLOT, n: Number.NaN } },
        { label: "instant", value: { ...SLOT, at: null } },
        { label: "channel list", value: { ...SLOT, channels: "facebook" } },
        { label: "channel entry", value: { ...SLOT, channels: ["facebook", "unsupported"] } },
        { label: "pillar object", value: { ...SLOT, pillar: null } },
        { label: "pillar id", value: { ...SLOT, pillar: { ...PILLAR, id: 1 } } },
        { label: "pillar name", value: { ...SLOT, pillar: { ...PILLAR, name: undefined } } },
        { label: "pillar description", value: { ...SLOT, pillar: { ...PILLAR, description: [] } } },
        { label: "pillar weight", value: { ...SLOT, pillar: { ...PILLAR, weight: Number.POSITIVE_INFINITY } } },
        { label: "pillar active state", value: { ...SLOT, pillar: { ...PILLAR, active: "yes" } } },
        { label: "holiday object", value: { ...SLOT, holiday: undefined } },
        { label: "holiday key", value: { ...SLOT, holiday: { ...EVENT, key: 2 } } },
        { label: "holiday date", value: { ...SLOT, holiday: { ...EVENT, date: null } } },
        { label: "holiday name", value: { ...SLOT, holiday: { ...EVENT, name: false } } },
        { label: "holiday angle", value: { ...SLOT, holiday: { ...EVENT, angle: {} } } },
        { label: "holiday preparation window", value: { ...SLOT, holiday: { ...EVENT, leadDays: "2" } } },
    ])("rejects malformed planned slot $label", async ({ value }) => {
        const subject = await build()

        expect(subject.isPlannedSlot(value)).toBe(false)
    })
    it.each([
        { channel: "facebook", warning: { kind: "promise", phrase: "Guaranteed" } },
        { channel: "zalo", warning: { kind: "figure", figure: "90%" } },
        { channel: "facebook", warning: { kind: "length", length: 240, max: 200 } },
    ])("accepts channel warning $warning.kind", async (value) => {
        const subject = await build()

        expect(subject.isChannelWarning(value)).toBe(true)
    })
})

describe("stored content AI context", () => {
    it.each([
        { label: "non-object", value: null },
        { label: "channel", value: { channel: "unsupported", warning: { kind: "promise", phrase: "Guaranteed" } } },
        { label: "warning object", value: { channel: "facebook", warning: null } },
        { label: "promise phrase", value: { channel: "facebook", warning: { kind: "promise", phrase: 2 } } },
        { label: "figure text", value: { channel: "facebook", warning: { kind: "figure", figure: false } } },
        { label: "warning kind", value: { channel: "facebook", warning: { kind: "unknown" } } },
        { label: "length", value: { channel: "facebook", warning: { kind: "length", length: "20", max: 10 } } },
        { label: "maximum", value: { channel: "facebook", warning: { kind: "length", length: 20, max: null } } },
    ])("rejects malformed channel warning $label", async ({ value }) => {
        const subject = await build()

        expect(subject.isChannelWarning(value)).toBe(false)
    })
})
