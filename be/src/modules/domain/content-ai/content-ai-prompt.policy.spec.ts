import {
    brandBlock,
    buildBrand,
    channelHashtags,
    channelRule,
    claimWarnings,
    cleanHashtags,
    clip,
    draftSystem,
    draftUser,
    draftVariants,
    guardrailBlock,
    isJsonObject,
    isOfferLine,
    localLabel,
    occasionText,
    offerLines,
    parseContentJson,
    planIdeas,
    planSystem,
    planUser,
    slotLine,
    trimmedText,
} from "./content-ai-prompt.policy"
import type { BrandContext, BrandMaterial, BrandSettings, DraftBrief } from "./content-ai-prompt.policy"
import { CONTENT_AI_CHANNEL_RULES, CONTENT_AI_GUARDRAILS, CONTENT_AI_PROMPTS } from "./content-ai.templates"

const BRAND: BrandContext = {
    shop: "Flower shop",
    knowledge: "Fresh roses.",
    sources: ["Catalogue"],
    voice: "warm",
    avoid: "No medical claims",
    audience: "Local buyers",
    cta: "Call us",
    brandHashtags: ["#flowers"],
}
const MATERIAL: BrandMaterial = {
    shop: "Flower shop",
    setup: { summary: "", facts: [], tone: "", claimsLimits: "", audience: "Local buyers", channels: "facebook" },
    authority: { brandVoice: "", replyStyle: "", limitsNote: "" },
    sources: [],
    brainFacts: [],
}
const SETTINGS: BrandSettings = { brandVoice: "", avoid: "", cta: "", hashtags: [] }
const PILLAR = { id: "p1", name: "Flowers", description: "Seasonal stems", weight: 1, active: true }
const HOLIDAY = { key: "new_year", date: "2027-01-01", name: "New Year", angle: "Share wishes" }
const BRIEF: DraftBrief = {
    title: "New roses",
    brief: "",
    pillar: null,
    pillarNames: [],
    scheduledAt: null,
    holiday: null,
    hint: "",
    recent: [],
    library: [],
}

describe("content prompt values", () => {
    it.each([
        [{}, true],
        [null, false],
        [[], false],
        ["text", false],
    ])("recognizes JSON object %j", (value, expected) => {
        expect(isJsonObject(value)).toBe(expected)
    })

    it("trims only text, clips over-budget content, and normalizes unique hashtags", () => {
        expect(trimmedText("  roses \n")).toBe("roses")
        expect(trimmedText({ text: "roses" })).toBe("")
        expect(clip("rose ", 5)).toBe("rose ")
        expect(clip("rose garden", 5)).toBe("rose...")
        expect(cleanHashtags([" ## roses ", "#roses", " garden # flowers", "", "### "])).toEqual([
            "#roses",
            "#gardenflowers",
        ])
    })

    it("builds an empty public brand without invented knowledge", () => {
        expect(buildBrand(MATERIAL, SETTINGS)).toEqual({
            shop: "Flower shop",
            knowledge: "",
            sources: [],
            voice: "",
            avoid: "",
            audience: "Local buyers",
            cta: "",
            brandHashtags: [],
        })
    })

    it("joins verified facts, source topics, authority settings, and owner settings", () => {
        expect(
            buildBrand(
                {
                    ...MATERIAL,
                    setup: {
                        ...MATERIAL.setup,
                        summary: "Fresh flowers",
                        facts: ["Open daily", "Local delivery"],
                        tone: " warm ",
                        claimsLimits: " no cures ",
                    },
                    authority: { brandVoice: " expert ", replyStyle: " short ", limitsNote: " no promises " },
                    brainFacts: [{ subject: "Shop", attribute: "Founded", value: "2020" }],
                    sources: [
                        { title: "Catalogue", topic: "roses", content: "  Seasonal stems  " },
                        { title: "Hours", topic: null, content: "Open daily" },
                    ],
                },
                {
                    brandVoice: " friendly ",
                    avoid: " no urgency ",
                    cta: " Call us ",
                    hashtags: ["flowers", "#flowers"],
                },
            ),
        ).toEqual({
            shop: "Flower shop",
            knowledge:
                "Business summary:\nFresh flowers\n\nConfirmed business facts:\n- Open daily\n- Local delivery\n\nApproved public business facts:\n- Shop - Founded: 2020\n\n### Catalogue (roses)\nSeasonal stems\n\n### Hours\nOpen daily",
            sources: ["Catalogue", "Hours"],
            voice: "warm | expert | short | friendly",
            avoid: "no cures | no promises | no urgency",
            audience: "Local buyers",
            cta: "Call us",
            brandHashtags: ["#flowers"],
        })
    })

    it("clips each source and omits blocks once the shared knowledge budget is exhausted", () => {
        const sources = Array.from({ length: 5 }, (_, i) => ({
            title: `Source ${i}`,
            topic: "",
            content: "x".repeat(1700),
        }))
        const brand = buildBrand({ ...MATERIAL, sources }, SETTINGS)
        expect(brand.knowledge).toBe(
            Array.from({ length: 4 }, (_, i) => `### Source ${i}\n${"x".repeat(1600)}...`).join("\n\n"),
        )
        expect(brand.sources).toEqual(["Source 0", "Source 1", "Source 2", "Source 3", "Source 4"])
    })

    it("clips the approved brain-fact block independently", () => {
        expect(
            buildBrand(
                { ...MATERIAL, brainFacts: [{ subject: "S", attribute: "A", value: "x".repeat(2600) }] },
                SETTINGS,
            ).knowledge,
        ).toBe(`Approved public business facts:\n- S - A: ${"x".repeat(2491)}...`)
    })

    it("returns each channel rule and the defensive Facebook fallback", () => {
        for (const rule of CONTENT_AI_CHANNEL_RULES) expect(channelRule(rule.key)).toEqual(rule)
        expect(Reflect.apply(channelRule, undefined, ["unknown"])).toEqual(CONTENT_AI_CHANNEL_RULES[0])
    })

    it("renders populated and default business blocks exactly", () => {
        expect(brandBlock(BRAND)).toBe(
            "Business: Flower shop\nAudience: Local buyers\nBrand voice: warm\nProhibited claims and limits: No medical claims\nPreferred call to action: Call us\nVerified public business knowledge:\nFresh roses.",
        )
        expect(brandBlock({ ...BRAND, shop: "", audience: "", voice: "", avoid: "", cta: "", knowledge: "" })).toBe(
            "Business: Unnamed business\nBrand voice: friendly, clear, useful, and restrained.\nVerified public business knowledge:\nNo verified facts are available. Keep the copy general and do not invent business details.",
        )
        expect(guardrailBlock()).toBe(
            `Mandatory rules:\n${CONTENT_AI_GUARDRAILS.map((rule) => `- ${rule}`).join("\n")}`,
        )
    })

    it("selects only recorded offer lines and caps them at twelve", () => {
        expect(isOfferLine("Fresh roses")).toBe(false)
        expect(isOfferLine("combo flowers")).toBe(true)
        expect(offerLines(BRAND)).toBe("No actual offers are recorded. Do not invent any.")
        expect(
            offerLines({
                ...BRAND,
                knowledge: "Ordinary line\n" + Array.from({ length: 13 }, (_, i) => `combo ${i}`).join("\n"),
            }),
        ).toBe(Array.from({ length: 12 }, (_, i) => `combo ${i}`).join("\n"))
    })

    it("labels Vietnam instants, occasions, and deterministic slot choices", () => {
        expect(localLabel("2026-12-31T18:05:00.000Z")).toBe("Friday 01/01/2027 01:05")
        expect(occasionText(HOLIDAY)).toBe("New Year on 01/01/2027: Share wishes")
        const slot = { n: 2, at: "2026-12-31T18:05:00.000Z", channels: ["facebook", "zalo"] as const }
        expect(slotLine(slot, PILLAR, HOLIDAY)).toBe(
            "Slot 2: Friday 01/01/2027 01:05; channels: Facebook, Zalo OA; theme: Flowers (Seasonal stems); occasion: New Year on 01/01/2027: Share wishes",
        )
        expect(slotLine(slot, { ...PILLAR, description: "" }, null)).toBe(
            "Slot 2: Friday 01/01/2027 01:05; channels: Facebook, Zalo OA; theme: Flowers",
        )
    })
})

describe("content prompts", () => {
    it("composes planner system and user messages with and without existing titles", () => {
        expect(planSystem(BRAND)).toBe(
            [CONTENT_AI_PROMPTS.planRole, brandBlock(BRAND), guardrailBlock(), CONTENT_AI_PROMPTS.planJson].join(
                "\n\n",
            ),
        )
        const base =
            "Plan month: 2027-01\n\nRequired slots:\nSlot one\nSlot two\n\nActual offers in the knowledge:\nNone"
        expect(planUser({ month: "2027-01", lines: ["Slot one", "Slot two"], offers: "None", existing: [] })).toBe(
            `${base}\n\n${CONTENT_AI_PROMPTS.planRules}`,
        )
        expect(
            planUser({
                month: "2027-01",
                lines: ["Slot one", "Slot two"],
                offers: "None",
                existing: ["Roses", "Lilies"],
            }),
        ).toBe(`${base}\n\nExisting titles to avoid repeating:\n- Roses\n- Lilies\n\n${CONTENT_AI_PROMPTS.planRules}`)
    })

    it("includes requested channel rules and an exact writer response shape", () => {
        expect(draftSystem(BRAND, ["zalo", "tiktok"])).toBe(
            [
                CONTENT_AI_PROMPTS.draftRole,
                brandBlock(BRAND),
                guardrailBlock(),
                `Channel rules:\nZalo OA, maximum 500 characters: ${CONTENT_AI_CHANNEL_RULES[1].rules}\nTikTok, maximum 300 characters: ${CONTENT_AI_CHANNEL_RULES[2].rules}`,
                CONTENT_AI_PROMPTS.draftJson.replace(
                    "__SHAPE__",
                    '"zalo":{"text":"...","hashtags":["#..."],"note":"..."},"tiktok":{"text":"...","hashtags":["#..."],"note":"..."}',
                ),
            ].join("\n\n"),
        )
    })

    it("writes the full post context, selected theme, and numbered media", () => {
        expect(
            draftUser({
                ...BRIEF,
                brief: "Show fresh stems",
                pillar: PILLAR,
                scheduledAt: "2026-12-31T18:05:00.000Z",
                holiday: HOLIDAY,
                hint: "Use a question",
                recent: ["Lilies", "Tulips"],
                library: ["rose.jpg", "shop.mp4"],
            }),
        ).toBe(
            "Idea: New roses\n\nBrief: Show fresh stems\n\nTheme: Flowers (Seasonal stems)\n\nScheduled: Friday 01/01/2027 01:05\n\nOccasion: New Year on 01/01/2027: Share wishes\n\nOwner hint: Use a question\n\nRecent titles to avoid repeating:\n- Lilies\n- Tulips\n\nAvailable media library:\n1. rose.jpg\n2. shop.mp4",
        )
    })

    it("provides missing-context fallbacks and handles a theme without description", () => {
        expect(draftUser(BRIEF)).toBe(
            "Idea: New roses\n\nChoose one theme: none supplied\n\nNo media library is available. Do not suggest media indices.",
        )
        expect(draftUser({ ...BRIEF, pillarNames: ["Flowers", "Care"] })).toBe(
            "Idea: New roses\n\nChoose one theme: Flowers; Care\n\nNo media library is available. Do not suggest media indices.",
        )
        expect(draftUser({ ...BRIEF, pillar: { ...PILLAR, description: "" } })).toBe(
            "Idea: New roses\n\nTheme: Flowers\n\nNo media library is available. Do not suggest media indices.",
        )
    })
})

describe("model response parsing", () => {
    it.each([
        [' {"title":"Roses"} ', { title: "Roses" }],
        ['```JSON\n{"title":"Roses"}\n```', { title: "Roses" }],
        ['Here is {"title":"Roses"} for you.', { title: "Roses" }],
        ['prefix {"outer":{"title":"Roses"} trailing', { outer: { title: "Roses" } }],
        ['prefix {"a":{"b":{"title":"Roses"} trailing', { a: { b: { title: "Roses" } } }],
        ['prefix {"a":{"b":{"c":{"title":"Roses"} trailing', { a: { b: { c: { title: "Roses" } } } }],
        ["[]", null],
        ["null", null],
        ["no object", null],
        ["only {", null],
        ["}{", null],
        ['{"a": malformed}', null],
        ['{"a":{"b":{"c":{"d":{"title":"Roses"}', null],
    ])("reads a JSON object from %s", (text, expected) => {
        expect(parseContentJson(text)).toEqual(expected)
    })

    it("rejects malformed idea entries and preserves numbered, trimmed, bounded ideas", () => {
        expect(planIdeas({ ideas: "bad" })).toEqual([])
        expect(
            planIdeas({
                ideas: [
                    null,
                    [],
                    { slot: "bad", title: "No" },
                    { slot: 1, title: " " },
                    { slot: "2", title: " Roses ", brief: " Care " },
                    { slot: 3, title: "x".repeat(201), brief: {} },
                ],
            }),
        ).toEqual([
            { slot: 2, title: "Roses", brief: "Care" },
            { slot: 3, title: "x".repeat(200), brief: "" },
        ])
    })

    it("normalizes channel tags, applies limits, and adds brand tags only for visual channels", () => {
        expect(channelHashtags("zalo", ["one"], ["brand"])).toEqual([])
        expect(channelHashtags("facebook", ["one", "two", "three", "four"], ["brand"])).toEqual([
            "#one",
            "#two",
            "#three",
        ])
        expect(channelHashtags("tiktok", ["one", 2, "#one"], ["brand", "#one"])).toEqual(["#one", "#2", "#brand"])
        expect(channelHashtags("instagram", null, ["brand"])).toEqual(["#brand"])
    })

    it("reports promises with their matched phrases and only unverified offer figures", () => {
        expect(
            claimWarnings(
                "cam k\u1ebft, \u0111\u1ea3m b\u1ea3o hi\u1ec7u qu\u1ea3, ch\u1eafc ch\u1eafn \u0111\u1eb9p, 100 %, v\u0129nh vi\u1ec5n",
            ),
        ).toEqual([
            { kind: "promise", phrase: "cam k\u1ebft" },
            { kind: "promise", phrase: "\u0111\u1ea3m b\u1ea3o hi\u1ec7u qu\u1ea3" },
            { kind: "promise", phrase: "ch\u1eafc ch\u1eafn \u0111\u1eb9p" },
            { kind: "promise", phrase: "100 %" },
            { kind: "promise", phrase: "v\u0129nh vi\u1ec5n" },
        ])
        expect(claimWarnings("sale 20 %. SALE 30 K.", "Recorded sale 20%.")).toEqual([
            { kind: "figure", figure: "30 K" },
        ])
        expect(claimWarnings("Fresh roses", "Fresh roses")).toEqual([])
    })

    it("ignores malformed and empty variants", () => {
        expect(draftVariants({ variants: [] }, ["facebook"], BRAND)).toEqual({ variants: {}, warnings: [] })
        expect(
            draftVariants(
                { variants: { facebook: null, zalo: { text: " " }, tiktok: { text: 9 } } },
                ["facebook", "zalo", "tiktok"],
                BRAND,
            ),
        ).toEqual({ variants: {}, warnings: [] })
    })

    it("preserves text and notes, attributes warnings, and flags lengths only above the allowance", () => {
        const text = "x".repeat(376)
        expect(
            draftVariants(
                {
                    variants: {
                        tiktok: { text: ` ${text} `, hashtags: ["roses"], note: " Film stems " },
                        zalo: { text: "sale 30 K" },
                        facebook: { text: "100%" },
                    },
                },
                ["tiktok", "zalo", "facebook"],
                BRAND,
            ),
        ).toEqual({
            variants: {
                tiktok: { text, hashtags: ["#roses", "#flowers"], note: "Film stems" },
                zalo: { text: "sale 30 K", hashtags: [], note: "" },
                facebook: { text: "100%", hashtags: [], note: "" },
            },
            warnings: [
                { channel: "tiktok", warning: { kind: "length", length: 376, max: 300 } },
                { channel: "zalo", warning: { kind: "figure", figure: "30 K" } },
                { channel: "facebook", warning: { kind: "promise", phrase: "100%" } },
            ],
        })
        expect(draftVariants({ variants: { tiktok: { text: "x".repeat(375) } } }, ["tiktok"], BRAND)).toEqual({
            variants: { tiktok: { text: "x".repeat(375), hashtags: ["#flowers"], note: "" } },
            warnings: [],
        })
    })
})
