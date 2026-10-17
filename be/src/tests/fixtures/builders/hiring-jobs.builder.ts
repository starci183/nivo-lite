import type { GenerateAdOutput, SaveJobParams } from "@modules/domain/hiring"
type JobRequirements = Required<NonNullable<SaveJobParams["requirements"]>>

/** Render catalog keys and parameters deterministically for the service expectations. */
export const text = (key: string, params: Record<string, string | number> = {}): string =>
    `${key}${JSON.stringify(params)}`
/** Build complete job requirements with optional overrides. */
export const requirementsOf = (overrides: Partial<JobRequirements> = {}): JobRequirements => ({
    skills: [],
    experienceYears: null,
    experienceNote: "",
    availability: [],
    mustHave: [],
    niceToHave: [],
    ...overrides,
})
/** The expected facts for the default cashier job. */
export const minimalFacts = (): string =>
    [
        text("hiring.facts.title", { title: "Cashier" }),
        text("hiring.facts.employment", { employment: text("hiring.employment.full_time") }),
        text("hiring.facts.pay", { pay: text("hiring.pay.negotiable") }),
        text("hiring.facts.headcount", { count: 1 }),
    ].join("\n")
export const cleanAds = { facebook: "Facebook {{link}}", zalo: "Zalo {{link}}", topcv: "Board {{link}}" }
export const unfairAds = JSON.stringify({
    facebook: "nu\nFacebook {{link}}",
    zalo: "Zalo {{link}}\nnu",
    topcv: "nu\nBoard {{link}}\nnu",
})
/** Build the generated advertisement result with deterministic timing. */
export const adOutput = (overrides: Partial<GenerateAdOutput> = {}): GenerateAdOutput => ({
    facebook: "Facebook https://jobs.example/shop/cashier",
    zalo: "Zalo https://jobs.example/shop/cashier",
    topcv: "Board https://jobs.example/shop/cashier",
    generatedAt: "2026-10-13T08:00:00.000Z",
    ms: 0,
    attempts: 1,
    sanitised: false,
    ...overrides,
})
export const retries: Array<[string, string, string, boolean]> = [
    ["not JSON", JSON.stringify(cleanAds), "hiring.ad.badFormat{}", false],
    [
        JSON.stringify({ facebook: "nu", zalo: "nu", topcv: "mang thai" }),
        JSON.stringify(cleanAds),
        text("hiring.ad.unfair", { traits: "hiring.fairness.gender{}, hiring.fairness.pregnancy{}" }),
        false,
    ],
    [unfairAds, unfairAds, text("hiring.ad.unfair", { traits: "hiring.fairness.gender{}" }), true],
]
