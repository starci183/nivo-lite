import { Test } from "@nestjs/testing"
import { firstRecordRow as realFirstRecordRow, firstStepRow as realFirstStepRow } from "./returned-rows.policy"

const SUBJECT = Symbol("returned-rows.policy")
type Subject = { firstStepRow: typeof realFirstStepRow; firstRecordRow: typeof realFirstRecordRow }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { firstStepRow: realFirstStepRow, firstRecordRow: realFirstRecordRow } },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const STEP = { id: "s1", lead_id: "l1", title: "Call", owner_name: "Minh" }
const RECORD = { ...STEP, workspace_id: "ws-1" }

describe("returned rows", () => {
    it("takes the first well-formed step a write answered", async () => {
        const subject = await buildSubject()

        expect(subject.firstStepRow([{ id: 1 }, STEP])).toEqual(STEP)
    })

    it("takes the first well-formed record a write answered", async () => {
        const subject = await buildSubject()

        expect(subject.firstRecordRow([STEP, RECORD])).toEqual(RECORD)
    })

    it.each([undefined, {}, [], [null], "rows"])("answers undefined for the raw answer %p", async (raw) => {
        const subject = await buildSubject()

        expect(subject.firstStepRow(raw)).toBeUndefined()
        expect(subject.firstRecordRow(raw)).toBeUndefined()
    })
})
