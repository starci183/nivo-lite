import { LINK_TOKEN, candidate, interview, offer } from "../../../../tests/fixtures/builders/hiring-row-mappers.builder"
import { Test } from "@nestjs/testing"
import type { ApplicationSource, InterviewStatus, OfferStatus, OfferTerms } from "../hiring.contracts"
import { STAGES } from "../hiring.contracts"
import type { HiringCandidateEntity, HiringInterviewEntity, HiringOfferEntity } from "../persistence/entities"
import {
    termsJson as termsJsonImplementation,
    toCandidate as toCandidateImplementation,
    toInterview as toInterviewImplementation,
    toOffer as toOfferImplementation,
} from "./row-mappers-records.policy"

const CREATED = new Date("2026-10-01T00:00:00.000Z")

/** Overrides of a candidate entity; the closed-list columns accept any text so fallback cases can be written. */
type CandidateOverrides = Partial<Omit<HiringCandidateEntity, "source" | "stage">> & {
    source?: string
    stage?: string
}

/** Overrides of an interview entity; the closed-list columns accept any text so fallback cases can be written. */
type InterviewOverrides = Partial<Omit<HiringInterviewEntity, "mode" | "status">> & {
    mode?: string
    status?: string
}

/** Overrides of an offer entity; the closed-list column accepts any text so fallback cases can be written. */
type OfferOverrides = Partial<Omit<HiringOfferEntity, "status">> & { status?: string }

/** Builds a complete candidate entity, with overrides for source and stage cases. */
const candidateEntity = (overrides: CandidateOverrides = {}): HiringCandidateEntity => {
    const base: HiringCandidateEntity = {
        id: "candidate-1",
        workspaceId: "ws-1",
        jobId: "job-1",
        name: "Alex",
        phone: "0912345678",
        email: "alex@example.test",
        source: "chat",
        conversationId: "conversation-1",
        cvPath: "cv/alex.pdf",
        cvName: "alex.pdf",
        cvMime: "application/pdf",
        cvSize: null,
        answers: [{ question_id: "q-1", question: "Can you make coffee?", answer: "yes" }],
        availability: "Monday morning",
        score: null,
        scoreLabel: null,
        scoreReasons: [],
        scoreSummary: null,
        screenedAt: null,
        stage: "shortlisted",
        stageChangedAt: CREATED,
        rejectedReason: null,
        notes: "",
        createdAt: CREATED,
        staffId: "staff-1",
    }
    return Object.assign(base, overrides)
}

/** Builds a complete interview entity, with overrides for date and status cases. */
const interviewEntity = (overrides: InterviewOverrides = {}): HiringInterviewEntity => {
    const base: HiringInterviewEntity = {
        id: "interview-1",
        workspaceId: "ws-1",
        candidateId: "candidate-1",
        jobId: "job-1",
        interviewerUserId: "user-1",
        interviewerName: "Blair",
        mode: "online",
        location: "https://example.test/meet",
        durationMin: 30,
        proposedSlots: [{ start: "2026-10-14T01:00:00.000Z", end: "2026-10-14T01:30:00.000Z" }],
        slotStart: new Date("2026-10-14T01:00:00.000Z"),
        slotEnd: new Date("2026-10-14T01:30:00.000Z"),
        status: "confirmed",
        token: LINK_TOKEN,
        workItemId: "work-1",
        reminderSentAt: null,
        note: "Bring examples",
        createdAt: CREATED,
    }
    return Object.assign(base, overrides)
}

/** Builds a complete offer entity, with overrides for terms and expiry cases. */
const offerEntity = (overrides: OfferOverrides = {}): HiringOfferEntity => {
    const base: HiringOfferEntity = {
        id: "offer-1",
        workspaceId: "ws-1",
        candidateId: "candidate-1",
        jobId: "job-1",
        terms: {
            title: "Barista",
            pay: "40000 per hour",
            start_date: "2026-10-20",
            probation: "One month",
            note: "Welcome",
        },
        draft: "Letter draft",
        status: "sent",
        token: LINK_TOKEN,
        workItemId: "work-1",
        sentVia: null,
        sentAt: null,
        expiresAt: new Date("2026-10-21T08:00:00+07:00"),
        respondedAt: null,
        createdBy: null,
        createdAt: CREATED,
    }
    return Object.assign(base, overrides)
}

const SUBJECT = Symbol("subject")
type Subject = {
    termsJson: typeof termsJsonImplementation
    toCandidate: typeof toCandidateImplementation
    toInterview: typeof toInterviewImplementation
    toOffer: typeof toOfferImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    termsJson: termsJsonImplementation,
                    toCandidate: toCandidateImplementation,
                    toInterview: toInterviewImplementation,
                    toOffer: toOfferImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("row mappers policy", () => {
    describe("toCandidate", () => {
        it("maps every candidate column and answer", async () => {
            const subject = await buildSubject()

            expect(subject.toCandidate(candidateEntity())).toEqual(candidate)
        })

        it("defaults an unknown source, unknown stage and null answers", async () => {
            const subject = await buildSubject()

            expect(
                subject.toCandidate(candidateEntity({ source: "unknown", stage: "unknown", answers: null })),
            ).toEqual({
                ...candidate,
                source: "page",
                stage: "applied",
                answers: [],
            })
        })

        const sources: Array<ApplicationSource> = ["page", "chat", "manual"]
        it.each(sources)("keeps the %s application source", async (source) => {
            const subject = await buildSubject()

            expect(subject.toCandidate(candidateEntity({ source }))).toEqual({ ...candidate, source })
        })

        it.each(STAGES)("keeps the %s candidate stage", async (stage) => {
            const subject = await buildSubject()

            expect(subject.toCandidate(candidateEntity({ stage }))).toEqual({ ...candidate, stage })
        })
    })
})

describe("row mappers policy interviews", () => {
    describe("toInterview", () => {
        it("maps every interview column and proposed slot", async () => {
            const subject = await buildSubject()

            expect(subject.toInterview(interviewEntity())).toEqual(interview)
        })

        it("defaults mode, slots, dates and status when unavailable", async () => {
            const subject = await buildSubject()

            expect(
                subject.toInterview(
                    interviewEntity({
                        mode: "unknown",
                        proposedSlots: null,
                        slotStart: null,
                        slotEnd: null,
                        status: "unknown",
                    }),
                ),
            ).toEqual({
                ...interview,
                mode: "in_person",
                proposedSlots: [],
                slotStart: null,
                slotEnd: null,
                status: "proposed",
            })
        })

        const statuses: Array<InterviewStatus> = ["proposed", "confirmed", "done", "cancelled", "no_show"]
        it.each(statuses)("keeps the %s interview status", async (status) => {
            const subject = await buildSubject()

            expect(subject.toInterview(interviewEntity({ status }))).toEqual({ ...interview, status })
        })

        it("keeps in person interviews", async () => {
            const subject = await buildSubject()

            expect(subject.toInterview(interviewEntity({ mode: "in_person" }))).toEqual({
                ...interview,
                mode: "in_person",
            })
        })
    })
})

describe("row mappers policy", () => {
    describe("termsJson", () => {
        it("writes the complete terms under snake case keys", async () => {
            const subject = await buildSubject()

            const terms: OfferTerms = offer.terms
            expect(subject.termsJson(terms)).toEqual({
                title: "Barista",
                pay: "40000 per hour",
                start_date: "2026-10-20",
                probation: "One month",
                note: "Welcome",
            })
        })
    })

    describe("toOffer", () => {
        it("maps every offer column and term", async () => {
            const subject = await buildSubject()

            expect(subject.toOffer(offerEntity())).toEqual(offer)
        })

        it.each([null, {}])("defaults every missing term from %s", async (terms) => {
            const subject = await buildSubject()

            expect(subject.toOffer(offerEntity({ terms, status: "unknown", expiresAt: null }))).toEqual({
                ...offer,
                terms: { title: "", pay: "", startDate: "", probation: "", note: "" },
                status: "draft",
                expiresAt: null,
            })
        })

        const statuses: Array<OfferStatus> = [
            "draft",
            "waiting",
            "sent",
            "accepted",
            "declined",
            "expired",
            "cancelled",
        ]
        it.each(statuses)("keeps the %s offer status", async (status) => {
            const subject = await buildSubject()

            expect(subject.toOffer(offerEntity({ status }))).toEqual({ ...offer, status })
        })
    })
})
