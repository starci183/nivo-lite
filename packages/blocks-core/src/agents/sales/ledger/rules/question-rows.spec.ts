import { answerOf, askedAtOf, questionRowsOf, questionsRecord } from "./question-rows"

const RECORD = {
    count: "2",
    rows: [
        {
            id: "q1",
            title: "Kho\u1ea3n 3.500.000 \u20ab thu\u1ed9c H\u0110 n\u00e0o?",
            description: "SePay",
            askedAt: "2026-11-04T02:12:00.000Z",
        },
        { id: "q2", title: "\u0110\u01a1n #1088?", description: "" },
    ],
}

describe("questionsRecord", () => {
    it("takes the queue the read answers, with or without the time asked", () => {
        expect(questionsRecord.safeParse(RECORD).success).toBe(true)
        expect(questionsRecord.safeParse({ ...RECORD, rows: [{ id: "" }] }).success).toBe(false)
    })
})

describe("askedAtOf", () => {
    it("writes the shop's wall time and nothing for no instant", () => {
        expect(askedAtOf("2026-11-04T02:12:00.000Z")).toBe("04/11 09:12")
        expect(askedAtOf(undefined)).toBe("")
        expect(askedAtOf("soon")).toBe("")
    })
})

describe("questionRowsOf", () => {
    it("lists the question, its source and when it was asked", () => {
        expect(questionRowsOf(RECORD)).toEqual([
            {
                id: "q1",
                question: "Kho\u1ea3n 3.500.000 \u20ab thu\u1ed9c H\u0110 n\u00e0o?",
                source: "SePay",
                asked: "04/11 09:12",
            },
            { id: "q2", question: "\u0110\u01a1n #1088?", source: "", asked: "" },
        ])
    })
})

describe("answerOf", () => {
    it("trims the answer and takes none for blank text", () => {
        expect(answerOf("  H\u0110-0139 ")).toBe("H\u0110-0139")
        expect(answerOf("   ")).toBeNull()
    })
})
