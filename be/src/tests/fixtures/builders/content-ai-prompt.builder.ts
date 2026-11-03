/** Deterministic brand and draft context for the content prompt policies. */
import type { BrandMaterial } from "@modules/domain/content-ai"

type BrandShape = {
    shop: string
    knowledge: string
    sources: Array<string>
    voice: string
    avoid: string
    audience: string
    cta: string
    brandHashtags: Array<string>
}

export const BRAND: BrandShape = {
    shop: "Flower shop",
    knowledge: "Fresh roses.",
    sources: ["Catalogue"],
    voice: "warm",
    avoid: "No medical claims",
    audience: "Local buyers",
    cta: "Call us",
    brandHashtags: ["#flowers"],
}

export const MATERIAL: BrandMaterial = {
    shop: "Flower shop",
    setup: { summary: "", facts: [], tone: "", claimsLimits: "", audience: "Local buyers", channels: "facebook" },
    authority: { brandVoice: "", replyStyle: "", limitsNote: "" },
    sources: [],
    brainFacts: [],
}

type SettingsShape = {
    brandVoice: string
    avoid: string
    cta: string
    hashtags: Array<never>
}

export const SETTINGS: SettingsShape = { brandVoice: "", avoid: "", cta: "", hashtags: [] }

export const PILLAR = { id: "p1", name: "Flowers", description: "Seasonal stems", weight: 1, active: true }

export const HOLIDAY = { key: "new_year", date: "2027-01-01", name: "New Year", angle: "Share wishes" }

type BriefShape = {
    title: string
    brief: string
    pillar: null
    pillarNames: Array<never>
    scheduledAt: null
    holiday: null
    hint: string
    recent: Array<never>
    library: Array<never>
}

export const BRIEF: BriefShape = {
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
