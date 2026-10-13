import { builder } from "@starci/jest-preset"
import type { JobQuestion } from "./hiring.contracts"
import { toHiringBenchType } from "./hiring-bench.mapper"
import type { HiringBenchView, HiringJobView } from "./hiring-workbench.contracts"

const question = builder<JobQuestion>({ id: "q-1", text: "Weekend?", type: "text", required: true })

const job = builder<HiringJobView>({
    id: "j-1",
    workspaceId: "ws-1",
    slug: "barista",
    title: "Barista",
    position: "Bar",
    employmentType: "part_time",
    schedule: "Evenings",
    payMinVnd: null,
    payMaxVnd: null,
    payUnit: "hour",
    location: "District 1",
    headcount: 1,
    description: "",
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
    channels: [],
    closesAt: null,
    adVariants: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    publicUrl: null,
})

const bench = builder<HiringBenchView>({
    nowIso: "2026-10-13T00:00:00.000Z",
    origin: "https://nivo.vn",
    settings: {
        workspaceId: "ws-1",
        publicSlug: "cafe",
        retentionDays: 90,
        notifyNewCandidate: true,
        remindInterview: true,
        autoCloseWhenFilled: false,
        applyConsentText: "",
        adTone: "warm",
    },
    jobs: [],
    candidates: [],
    interviews: [],
    offers: [],
    onboarding: [],
    members: [],
    waitingApprovals: 0,
    figures: { openRoles: 1, totalRoles: 1, pipeline: 0, interviewsWeek: 0, offersWaiting: 0, offersSent: 0 },
    meUserId: "user-1",
})

const fieldsOf = (expectation: Partial<JobQuestion>) =>
    toHiringBenchType(bench({ jobs: [job({ questions: [question(expectation)] })] })).jobs[0]?.questions[0]

describe("toHiringBenchType", () => {
    it("keeps the bench and its jobs as they are apart from the questions", () => {
        const view = bench({ jobs: [job()] })

        expect(toHiringBenchType(view)).toEqual({ ...view, jobs: [{ ...job(), questions: [] }] })
    })

    it("writes a question without choices or expectation with empty choices and null expectations", () => {
        expect(fieldsOf({})).toEqual({
            id: "q-1",
            text: "Weekend?",
            type: "text",
            required: true,
            choices: [],
            expectYesNo: null,
            expectNumber: null,
            expectChoices: null,
        })
    })

    it.each([
        { expect: "yes" as const, fields: { expectYesNo: "yes", expectNumber: null, expectChoices: null } },
        { expect: "no" as const, fields: { expectYesNo: "no", expectNumber: null, expectChoices: null } },
        { expect: 3, fields: { expectYesNo: null, expectNumber: 3, expectChoices: null } },
        { expect: ["Sat"], fields: { expectYesNo: null, expectNumber: null, expectChoices: ["Sat"] } },
    ])("splits the expectation $expect into its typed field", ({ expect: expectation, fields }) => {
        expect(fieldsOf({ choices: ["Sat", "Sun"], expect: expectation })).toMatchObject({
            choices: ["Sat", "Sun"],
            ...fields,
        })
    })
})
