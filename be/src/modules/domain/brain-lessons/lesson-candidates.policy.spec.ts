import type { LessonCandidate } from "./lesson-candidates.contracts"
import {
    contradictionReasonOf,
    groupOf,
    learnedReasonOf,
    lessonWordsOf,
    maskedOf,
    namesCustomerData,
    sameAnswer,
    sameGap,
    withinWords,
} from "./lesson-candidates.policy"

const candidateOf = (over: Partial<LessonCandidate>): LessonCandidate => ({
    id: "c1",
    stopId: "s1",
    runId: "r1",
    agentId: "a1",
    workflowId: "w1",
    stepKey: "match",
    question: "",
    keywords: [],
    answer: "Ghi nhận cho đơn đang chờ",
    answeredBy: "m1",
    answeredAt: "2026-11-10T09:00:00.000Z",
    thenDid: "completed",
    general: null,
    groupId: "g1",
    status: "candidate",
    changeId: null,
    factKey: null,
    factId: null,
    ...over,
})

describe("lesson candidates policy", () => {
    it("words of a question leave out codes and amounts, so two wrong-code stops are the same gap", () => {
        const first = lessonWordsOf("Chuyển khoản 3.000 với mã DH202611109999 không khớp đơn nào, có ghi nhận không?")
        const second = lessonWordsOf("Chuyển khoản 5.000 với mã DH202611118888 không khớp đơn nào, có ghi nhận không?")

        expect(first.some((word) => /\d/.test(word))).toBe(false)
        expect(sameGap(first, second)).toBe(true)
        expect(sameGap(first, lessonWordsOf("Khách hỏi giao hàng ra Phú Quốc mất mấy ngày?"))).toBe(false)
        expect(sameGap([], [])).toBe(true)
    })

    it("joins the nearest recent candidate's group, or none", () => {
        const words = lessonWordsOf("chuyển khoản sai mã ghi nhận")
        const recent = [candidateOf({ groupId: "g9", keywords: lessonWordsOf("giao hàng Phú Quốc") }), candidateOf({ keywords: words })]

        expect(groupOf(recent, words)).toBe("g1")
        expect(groupOf([], words)).toBeNull()
    })

    it("masks phones and e-mails and spots customer data in a drafted truth", () => {
        expect(maskedOf("Gọi 0912.345.678 hoặc +84 912 345 678, mail an@shop.vn", 200)).toBe("Gọi … hoặc …, mail …")
        expect(namesCustomerData("đơn DH202611109999")).toBe(true)
        expect(namesCustomerData("ghi nhận cho đơn đang chờ, tối đa 3.000 ₫")).toBe(false)
    })

    it("tells answers that say the same from answers that differ", () => {
        expect(sameAnswer("Ghi nhận cho đơn đang chờ nhé", "Cứ ghi nhận cho đơn đang chờ")).toBe(true)
        expect(sameAnswer("Ghi nhận cho đơn đang chờ", "Hoàn tiền cho khách")).toBe(false)
    })

    it("a drafted value stays within the person's words", () => {
        expect(withinWords("ghi nhận cho đơn đang chờ", ["Cứ ghi nhận cho đơn đang chờ đi"])).toBe(true)
        expect(withinWords("hoàn tiền gấp đôi", ["Cứ ghi nhận cho đơn đang chờ đi"])).toBe(false)
    })

    it("writes the reasons in plain Vietnamese", () => {
        const older = candidateOf({ answer: "Ghi nhận" })
        const newer = candidateOf({ answer: "Hoàn tiền", answeredAt: "2026-11-11T09:00:00.000Z" })

        expect(learnedReasonOf("chuyển khoản sai mã", [older, older])).toBe(
            "Đã hỏi chủ tiệm 2 lần về chuyển khoản sai mã; chủ tiệm trả lời: 'Ghi nhận'; đề nghị ghi thành quy định để lần sau tự xử lý.",
        )
        expect(contradictionReasonOf("chuyển khoản sai mã", [older, newer], older, newer)).toContain(
            "hai câu trả lời khác nhau: 'Ghi nhận' (10/11) và 'Hoàn tiền' (11/11)",
        )
    })
})
