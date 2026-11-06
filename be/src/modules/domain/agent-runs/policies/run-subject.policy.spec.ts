import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { subjectOfRun } from "./run-subject.policy"

interface Subject {
    readonly subjectOfRun: typeof subjectOfRun
}

const SUBJECT = Symbol("run-subject.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<Subject>({ subjectOfRun }) }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const ORDER = { kind: "sales.order", id: "o1" }

describe("the subject of a run", () => {
    it("is the subject of the trigger the host wrote into the first step", async () => {
        const policy = await build()
        expect(policy.subjectOfRun({ trigger: { subject: ORDER } }, {})).toEqual(ORDER)
    })

    it("is the subject of the run's own context when the step's trigger names none", async () => {
        const policy = await build()
        expect(policy.subjectOfRun({ trigger: {} }, { subject: ORDER })).toEqual(ORDER)
        expect(policy.subjectOfRun(null, { subject: ORDER })).toEqual(ORDER)
    })

    it("prefers the step's trigger over the context", async () => {
        const policy = await build()
        const other = { kind: "sales.lead", id: "l1" }
        expect(policy.subjectOfRun({ trigger: { subject: other } }, { subject: ORDER })).toEqual(other)
    })

    it("is nothing when no subject is named or it is not two non-empty texts", async () => {
        const policy = await build()
        expect(policy.subjectOfRun({}, {})).toBeNull()
        expect(policy.subjectOfRun([1], [1])).toBeNull()
        expect(policy.subjectOfRun({ trigger: { subject: "x" } }, {})).toBeNull()
        expect(policy.subjectOfRun({ trigger: { subject: { kind: "", id: "1" } } }, {})).toBeNull()
        expect(policy.subjectOfRun({ trigger: { subject: { kind: "k", id: 3 } } }, {})).toBeNull()
    })
})
