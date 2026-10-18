import { createHash } from "node:crypto"
import type { OfferRecord, HiringBenchView, RequestOfferParams, HiringCandidatesService } from "@modules/domain/hiring"
import { builder } from "@starci/jest-preset"
import type { PerformContext } from "@modules/domain/module-ops"

type CandidateRecord = Awaited<ReturnType<HiringCandidatesService["requireCandidate"]>>

/** Deterministic 32-hex offer link token derived from a fixture label. */
export const TOKEN = createHash("sha256").update("fixture-hiring-offer-token").digest("hex").slice(0, 32)
export const staleResponses = [{ rows: [] }, { rows: [{ value: null }] }, { rows: [{ value: "sent" }] }]
/** Render catalog keys and parameters deterministically for the service expectations. */
export const text = (key: string, params: Readonly<Record<string, string | number>> = {}): string =>
    `${key}${JSON.stringify(params)}`
export const contextOf = builder<PerformContext>({
    workspaceId: "ws-1",
    workItemId: "work-1",
    actor: "Manager",
    draft: " Approved letter ",
    fields: { offer_id: "offer-1", candidate_id: "candidate-1" },
})
export const modelOutput = JSON.stringify({
    opening: "**Welcome to our team.**",
    closing: "We look forward to meeting you.",
})
/** Build the expected offer-generation request for the job title. */
export const generatorValue = (title: string) => ({
    workspaceId: "ws-1",
    purpose: "hiring_offer",
    module: "hiring",
    system: text("hiring.offer.system"),
    user: text("hiring.offer.user", { shop: "Coffee Shop", name: "Alice", title }),
    timeoutMs: 75000,
})
export const onboarding = [1, 2, 3, 4, 5, 6, 7].map((step) => text(`hiring.onboarding.${step}`))

export const candidateOf = builder<CandidateRecord>({
    id: "candidate-1",
    workspaceId: "ws-1",
    jobId: "job-1",
    name: "Alice",
    phone: "0901234567",
    email: "alice@example.com",
    source: "page",
    conversationId: null,
    cvPath: null,
    cvName: null,
    cvMime: null,
    answers: [],
    availability: "Monday",
    stage: "shortlisted",
    staffId: null,
})

type JobRecord = Omit<HiringBenchView["jobs"][number], "adVariants" | "createdAt" | "updatedAt" | "publicUrl">
type OfferTerms = Omit<RequestOfferParams, "candidateId">

export const jobOf = builder<JobRecord>({
    id: "job-1",
    workspaceId: "ws-1",
    slug: "barista",
    title: "Barista",
    position: "Barista",
    employmentType: "full_time",
    schedule: "Monday to Friday",
    payMinVnd: 100,
    payMaxVnd: 100,
    payUnit: "shift",
    location: "Main Street",
    headcount: 1,
    description: "Prepare drinks",
    requirements: {
        skills: [],
        experienceYears: null,
        experienceNote: "",
        availability: [],
        mustHave: [],
        niceToHave: [],
    },
    questions: [],
    status: "open",
    channels: ["page"],
    closesAt: null,
})
export const termsOf = builder<OfferTerms>({
    title: "Lead Barista",
    pay: "100 per shift",
    startDate: "2026-11-01",
    probation: "One month",
    note: "Bring a notebook",
})
const termsText = ({ title, pay, startDate, probation, note }: OfferTerms): string =>
    [
        text("hiring.offer.termsHead"),
        text("hiring.offer.termPosition", { title, employment: text("hiring.employment.full_time") }),
        text("hiring.offer.termPay", { pay }),
        text("hiring.offer.termStart", { date: startDate }),
        text("hiring.offer.termProbation", { probation }),
        text("hiring.offer.termPlace", { place: "Main Street" }),
        text("hiring.offer.termNote", { note }),
        text("hiring.offer.termValid", { days: 7 }),
    ].join("\n")
/** Render the deterministic fallback offer letter for the supplied terms. */
export const template = (terms: OfferTerms = termsOf()): string =>
    [
        text("hiring.offer.opening", { name: "Alice", shop: "Coffee Shop", title: terms.title }),
        termsText(terms),
        text("hiring.offer.closing"),
        text("hiring.offer.signoff", { shop: "Coffee Shop" }),
    ].join("\n\n")
/** Render the deterministic generated offer letter for the supplied terms. */
export const modelLetter = (terms: OfferTerms = termsOf()): string =>
    [
        "Welcome to our team.",
        termsText(terms),
        "We look forward to meeting you.",
        text("hiring.offer.signoff", { shop: "Coffee Shop" }),
    ].join("\n\n")

/** A stored offer bound to its candidate and public link. */
export const offerOf = builder<OfferRecord>({
    id: "offer-1",
    workspaceId: "ws-1",
    candidateId: "candidate-1",
    jobId: "job-1",
    terms: termsOf(),
    draft: "Stored letter",
    status: "sent",
    token: TOKEN,
    workItemId: "work-1",
    expiresAt: "2026-10-19T00:00:00.000Z",
})
