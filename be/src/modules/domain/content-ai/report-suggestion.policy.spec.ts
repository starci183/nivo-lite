import { Test } from "@nestjs/testing"
import { readSuggestion, suggestionMessages, suggestionSourcesOf } from "./report-suggestion.policy"
import type { GuidelineKit, MarketingWeeklyReport } from "./content-agent.contracts"

const KIT: GuidelineKit = {
    brandName: "HAKUEN",
    colors: [],
    fonts: [],
    tone: "Warm and calm.",
    address: "",
    imagery: [],
    avoid: [],
}

const REPORT: MarketingWeeklyReport = {
    weekStart: "2026-10-12",
    weekEnd: "2026-10-18",
    reach: { value: 12480, previous: 10000, changePct: 25 },
    engagements: { value: 1286, previous: 900, changePct: 43 },
    messages: { value: 48, previous: 36, changePct: 33 },
    days: [{ day: "2026-10-12", byChannel: { facebook: 120 }, channels: [{ channel: "facebook", value: 120 }] }],
    channels: ["facebook", "zalo"],
    posts: [
        {
            id: "PAGE_1",
            channel: "facebook",
            title: "Relax at HAKUEN",
            publishedAt: "2026-10-18T02:00:00.000Z",
            engagements: 356,
            href: null,
        },
    ],
    postCount: 8,
    suggestion: null,
}

describe("suggestionMessages", () => {
    it("asks for one grounded JSON suggestion in the brand tone and hands the week's numbers as the input", () => {
        const [system, user] = suggestionMessages(REPORT, KIT, "vi")

        expect(system?.role).toBe("system")
        expect(system?.content).toContain('{"title": string, "body": string}')
        expect(system?.content).toContain("never invent a figure")
        expect(system?.content).toContain("Write in Vietnamese.")
        expect(system?.content).toContain("Brand: HAKUEN. Tone: Warm and calm.")
        expect(user?.role).toBe("user")
        expect(user?.content).toBe(
            JSON.stringify({
                week: { start: "2026-10-12", end: "2026-10-18" },
                channels: ["facebook", "zalo"],
                reach: REPORT.reach,
                engagements: REPORT.engagements,
                messages: REPORT.messages,
                engagementsPerDay: [{ day: "2026-10-12", byChannel: { facebook: 120 } }],
                postsPublished: 8,
                topPosts: [
                    {
                        title: "Relax at HAKUEN",
                        channel: "facebook",
                        publishedAt: "2026-10-18T02:00:00.000Z",
                        engagements: 356,
                    },
                ],
            }),
        )
    })

    it("writes in English and says when no brand kit is confirmed", () => {
        const [system] = suggestionMessages(REPORT, null, "en")

        expect(system?.content).toContain("Write in English.")
        expect(system?.content).toContain("No brand kit is confirmed yet.")
    })
})

describe("readSuggestion", () => {
    it("reads the title and the body, trimmed and cut to their limits", () => {
        expect(readSuggestion(JSON.stringify({ title: "  Short videos led ", body: "b".repeat(700) }))).toEqual({
            title: "Short videos led",
            body: "b".repeat(600),
        })
    })

    it("answers null for text that is not JSON, not an object, or misses a part", () => {
        expect(readSuggestion("not json")).toBeNull()
        expect(readSuggestion("[1]")).toBeNull()
        expect(readSuggestion(JSON.stringify({ title: "t", body: 3 }))).toBeNull()
        expect(readSuggestion(JSON.stringify({ title: " ", body: "b" }))).toBeNull()
    })
})

describe("suggestionSourcesOf", () => {
    it("names the Page insights, the customer messages, the ranked posts of each channel and the brand kit", () => {
        const zalo = {
            id: "art-1",
            channel: "zalo",
            title: "A",
            publishedAt: "2026-10-17T02:00:00.000Z",
            engagements: 10,
            href: null,
        }

        expect(suggestionSourcesOf({ ...REPORT, posts: [...REPORT.posts, zalo] }, KIT)).toEqual([
            { layer: 1, kind: "connector", ref: "meta.page_insights", label: "facebook" },
            { layer: 1, kind: "connector", ref: "channel.messages", label: "facebook, zalo" },
            { layer: 1, kind: "connector", ref: "meta.published_posts", label: "facebook" },
            { layer: 1, kind: "connector", ref: "zalo.articles", label: "zalo" },
            { layer: 2, kind: "brain_fact", ref: "brand_kit:HAKUEN", label: "HAKUEN" },
        ])
    })

    it("names nothing a channel did not give: no Page, no messages, no posts, no brand kit", () => {
        expect(
            suggestionSourcesOf(
                { ...REPORT, channels: ["zalo"], posts: [], messages: { value: 0, previous: 0, changePct: null } },
                null,
            ),
        ).toEqual([])
    })
})

const SUBJECT = Symbol("report-suggestion.policy")

describe("report-suggestion policy module", () => {
    it("is provided to Nest as its real functions", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: { readSuggestion, suggestionMessages, suggestionSourcesOf } }],
        }).compile()

        expect(moduleRef.get<{ readonly readSuggestion: typeof readSuggestion }>(SUBJECT).readSuggestion).toBe(
            readSuggestion,
        )
    })
})
