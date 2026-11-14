import { Test } from "@nestjs/testing"
import { answerShaperOf } from "./nivo-api-answers.policy"
import { NIVO_API } from "@nivo-lite/agent-sdk/names"

const SUBJECT = Symbol("nivo-api-answers.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { answerShaperOf } }],
    }).compile()
    return moduleRef.get<typeof import("./nivo-api-answers.policy")>(SUBJECT)
}


const DOOR = { data: '{"rows":[1]}' }

describe("the answers of the NIVO data ops", () => {
    let subject: Awaited<ReturnType<typeof build>>

    beforeEach(async () => {
        subject = await build()
    })

    describe("answerShaperOf: what an op answers from what its handler answered", () => {
        it.each([
            [NIVO_API.contact.get, { detail: { id: "c-1" } }],
            [NIVO_API.contact.blockList, { agents: { id: "c-1" } }],
            [NIVO_API.contact.memoryForget, { forgotten: { id: "c-1" } }],
            [NIVO_API.contact.delete, { deleted: { id: "c-1" } }],
            [NIVO_API.chatThread.list, { threads: { id: "c-1" } }],
            [NIVO_API.record.typeList, { modules: { id: "c-1" } }],
            [NIVO_API.accountData.typeList, { types: { id: "c-1" } }],
            [NIVO_API.agent.list, { agents: { id: "c-1" } }],
            [NIVO_API.workflow.list, { workflows: { id: "c-1" } }],
            [NIVO_API.run.get, { run: { id: "c-1" } }],
            [NIVO_API.theme.get, { theme: { id: "c-1" } }],
            [NIVO_API.theme.update, { theme: { id: "c-1" } }],
            [NIVO_API.theme.reset, { reset: { id: "c-1" } }],
        ])("names what %s answered as the member its declared output has", (name, shaped) => {
            expect(subject.answerShaperOf(name)({ id: "c-1" })).toEqual(shaped)
        })

        it.each([NIVO_API.file.upload, NIVO_API.file.confirm, NIVO_API.file.link, NIVO_API.file.get, NIVO_API.file.delete])(
            "reads the JSON text of a door answer of %s as data",
            (name) => {
                expect(subject.answerShaperOf(name)(DOOR)).toEqual({ rows: [1] })
            },
        )

        it("reads a workbench door answer as the data of a read and as the result of an action", () => {
            expect(subject.answerShaperOf(NIVO_API.workbench.read)(DOOR)).toEqual({ data: { rows: [1] } })
            expect(subject.answerShaperOf(NIVO_API.workbench.action)(DOOR)).toEqual({ result: { rows: [1] } })
        })

        it("answers a thread page as its messages and the cursor of the next page, or none on the last page", () => {
            const shape = subject.answerShaperOf(NIVO_API.chatThread.get)

            expect(shape({ nodes: [{ id: "m-1" }], hasNextPage: true, endCursor: "c-2" })).toEqual({ messages: [{ id: "m-1" }], next: "c-2" })
            expect(shape({ nodes: [], hasNextPage: false, endCursor: "c-2" })).toEqual({ messages: [], next: null })
        })

        it("refuses a door answer that holds no JSON text, and a thread page that is none", () => {
            expect(() => subject.answerShaperOf(NIVO_API.file.get)({ data: "{not json" })).toThrow()
            expect(() => subject.answerShaperOf(NIVO_API.file.get)({})).toThrow()
            expect(() => subject.answerShaperOf(NIVO_API.chatThread.get)({ nodes: "x" })).toThrow()
        })

        it("answers what the handler answered for an op that names no member", () => {
            const answered = { contacts: [], next: null }

            expect(subject.answerShaperOf(NIVO_API.contact.list)(answered)).toBe(answered)
            expect(subject.answerShaperOf(NIVO_API.workflow.run)(answered)).toBe(answered)
        })
    })
})
