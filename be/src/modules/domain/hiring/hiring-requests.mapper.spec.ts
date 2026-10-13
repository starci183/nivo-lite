import {
    toApplyToHiringJobRequest,
    toMoveHiringCandidateRequest,
    toRequestHiringInterviewRequest,
    toRespondHiringInterviewRequest,
    toSaveHiringJobRequest,
    toSaveHiringSettingsRequest,
} from "./hiring-requests.mapper"

const REQUIREMENTS = {
    skills: ["barista"],
    experienceNote: "",
    availability: ["morning"],
    mustHave: ["weekend"],
    niceToHave: [],
}

describe("hiring requests", () => {
    it("keeps a given stage move reason and drops an absent or null one", () => {
        expect(toMoveHiringCandidateRequest("ws-1", { id: "c-1", stage: "rejected", reason: "late" })).toEqual({
            workspaceId: "ws-1",
            id: "c-1",
            stage: "rejected",
            reason: "late",
        })
        expect(toMoveHiringCandidateRequest("ws-1", { id: "c-1", stage: "hired", reason: null })).toEqual({
            workspaceId: "ws-1",
            id: "c-1",
            stage: "hired",
        })
        expect(toMoveHiringCandidateRequest("ws-1", { id: "c-1", stage: "hired" })).not.toHaveProperty("reason")
    })

    it("keeps a given interviewer and drops an absent or null one", () => {
        const form = { candidateId: "c-1", mode: "online" as const, location: "Meet", durationMin: 30 }

        expect(toRequestHiringInterviewRequest("ws-1", { ...form, interviewerUserId: "u-1" })).toEqual({
            workspaceId: "ws-1",
            ...form,
            interviewerUserId: "u-1",
        })
        expect(toRequestHiringInterviewRequest("ws-1", { ...form, interviewerUserId: null })).toEqual({
            workspaceId: "ws-1",
            ...form,
        })
        expect(toRequestHiringInterviewRequest("ws-1", form)).not.toHaveProperty("interviewerUserId")
    })

    it("saves only the settings given", () => {
        const given = {
            publicSlug: "cafe",
            retentionDays: 90,
            notifyNewCandidate: true,
            remindInterview: false,
            autoCloseWhenFilled: true,
            applyConsentText: "OK",
            adTone: "warm",
        }

        expect(toSaveHiringSettingsRequest("ws-1", given)).toEqual({ workspaceId: "ws-1", ...given })
        expect(
            toSaveHiringSettingsRequest("ws-1", {
                publicSlug: null,
                retentionDays: null,
                notifyNewCandidate: null,
                remindInterview: null,
                autoCloseWhenFilled: null,
                applyConsentText: null,
                adTone: null,
            }),
        ).toEqual({ workspaceId: "ws-1" })
        expect(toSaveHiringSettingsRequest("ws-1", {})).toEqual({ workspaceId: "ws-1" })
    })

    it("maps a full job form with its requirements and questions", () => {
        expect(
            toSaveHiringJobRequest("ws-1", {
                id: "j-1",
                title: "Barista",
                position: "Bar",
                employmentType: "part_time",
                schedule: "Evenings",
                payMinVnd: 25000,
                payMaxVnd: 30000,
                payUnit: "hour",
                location: "District 1",
                headcount: 2,
                description: "Make coffee",
                requirements: { ...REQUIREMENTS, experienceYears: 1 },
                questions: [
                    {
                        id: "q-1",
                        text: "Weekend?",
                        type: "choice",
                        required: true,
                        choices: ["Sat", "Sun"],
                        expectYesNo: "yes",
                        expectNumber: 2,
                        expectChoices: ["Sat"],
                    },
                ],
                channels: ["facebook"],
                closesAt: "2026-11-01",
            }),
        ).toEqual({
            workspaceId: "ws-1",
            id: "j-1",
            title: "Barista",
            position: "Bar",
            employmentType: "part_time",
            schedule: "Evenings",
            payMinVnd: 25000,
            payMaxVnd: 30000,
            payUnit: "hour",
            location: "District 1",
            headcount: 2,
            description: "Make coffee",
            requirements: { ...REQUIREMENTS, experienceYears: 1 },
            questions: [
                {
                    id: "q-1",
                    text: "Weekend?",
                    type: "choice",
                    required: true,
                    choices: ["Sat", "Sun"],
                    expectYesNo: "yes",
                    expectNumber: 2,
                    expectChoices: ["Sat"],
                },
            ],
            channels: ["facebook"],
            closesAt: "2026-11-01",
        })
    })

    it("drops every absent or null job field and writes absent experience as null", () => {
        const nulls = {
            id: null,
            position: null,
            employmentType: null,
            schedule: null,
            payMinVnd: null,
            payMaxVnd: null,
            payUnit: null,
            location: null,
            headcount: null,
            description: null,
            channels: null,
            closesAt: null,
        }
        const question = { text: "Why?", type: "text" as const, required: false }

        expect(
            toSaveHiringJobRequest("ws-1", {
                ...nulls,
                title: "Barista",
                requirements: null,
                questions: [
                    {
                        ...question,
                        id: null,
                        choices: null,
                        expectYesNo: null,
                        expectNumber: null,
                        expectChoices: null,
                    },
                ],
            }),
        ).toEqual({ workspaceId: "ws-1", title: "Barista", questions: [question] })
        expect(toSaveHiringJobRequest("ws-1", { title: "Barista", requirements: REQUIREMENTS, questions: [] })).toEqual(
            {
                workspaceId: "ws-1",
                title: "Barista",
                requirements: { ...REQUIREMENTS, experienceYears: null },
                questions: [],
            },
        )
    })

    it("keeps a given CV and website on an application and drops absent or null ones", () => {
        const form = {
            ws: "cafe",
            job: "barista",
            name: "Lan",
            phone: "0900000000",
            email: "lan@nivo.vn",
            availability: "evenings",
            consent: true,
            answers: [],
        }

        expect(toApplyToHiringJobRequest({ ...form, cvPath: "cv/1.pdf", cvName: "cv.pdf", website: "" })).toEqual({
            ...form,
            cvPath: "cv/1.pdf",
            cvName: "cv.pdf",
            website: "",
        })
        expect(toApplyToHiringJobRequest({ ...form, cvPath: null, cvName: null, website: null })).toEqual(form)
    })

    it("keeps a chosen interview slot and drops an absent or null one", () => {
        expect(toRespondHiringInterviewRequest({ token: "t", start: "2026-11-01T09:00:00Z" })).toEqual({
            token: "t",
            start: "2026-11-01T09:00:00Z",
        })
        expect(toRespondHiringInterviewRequest({ token: "t", start: null })).toEqual({ token: "t" })
        expect(toRespondHiringInterviewRequest({ token: "t" })).toEqual({ token: "t" })
    })
})
