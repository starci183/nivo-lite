import { leadCareOf } from "./lead-care.policy"

describe("leadCareOf", () => {
    it("reads the opt-out, the receiver, the delivery and the occasions of the lead facts", () => {
        const care = leadCareOf("lead-1", {
            careOptOut: true,
            recipientName: " M\u1eb9 ",
            deliveryAt: "s\u00e1ng th\u1ee9 b\u1ea3y",
            address: "25 Nguy\u1ec5n Hu\u1ec7",
            occasions: [
                { label: "Sinh nh\u1eadt m\u1eb9", date: "03-08" },
                { label: "K\u1ef7 ni\u1ec7m c\u01b0\u1edbi", date: "2027-12-24" },
            ],
        })

        expect(care).toMatchObject({
            leadId: "lead-1",
            optedOut: true,
            recipient: "M\u1eb9",
            deliveryAt: "s\u00e1ng th\u1ee9 b\u1ea3y",
            address: "25 Nguy\u1ec5n Hu\u1ec7",
            occasions: [
                { label: "Sinh nh\u1eadt m\u1eb9", month: 3, day: 8, year: null },
                { label: "K\u1ef7 ni\u1ec7m c\u01b0\u1edbi", month: 12, day: 24, year: 2027 },
            ],
        })
    })

    it("never counts an unreadable value as an opt-out, and nothing known at all as nothing", () => {
        for (const stored of [undefined, null, "x", 3, [], { careOptOut: "true" }, { careOptOut: 1 }]) {
            expect(leadCareOf("lead-1", stored).optedOut).toBe(false)
        }
        expect(leadCareOf("lead-1", null)).toEqual({
            leadId: "lead-1",
            optedOut: false,
            recipient: null,
            deliveryAt: null,
            address: null,
            occasions: [],
        })
    })

    it("keeps only an occasion with a label and a valid MM-DD or YYYY-MM-DD date", () => {
        const care = leadCareOf("lead-1", {
            occasions: [
                { label: "ok", date: "12-31" },
                { label: "", date: "01-01" },
                { label: "no date" },
                { label: "month 13", date: "13-01" },
                { label: "day 0", date: "01-00" },
                { label: "words", date: "next week" },
                "plain text",
            ],
        })

        expect(care.occasions.map((occasion) => occasion.label)).toEqual(["ok"])
    })

    it("gives each occasion a stable id: the same label and date keep it, another date gets another", () => {
        const first = leadCareOf("lead-1", { occasions: [{ label: "Sinh nh\u1eadt", date: "03-08" }] }).occasions[0]
        const again = leadCareOf("lead-2", { occasions: [{ label: "Sinh nh\u1eadt", date: "03-08" }] }).occasions[0]
        const moved = leadCareOf("lead-1", { occasions: [{ label: "Sinh nh\u1eadt", date: "03-09" }] }).occasions[0]

        expect(first?.occasionId).toMatch(/^[0-9a-f]{16}$/u)
        expect(again?.occasionId).toBe(first?.occasionId)
        expect(moved?.occasionId).not.toBe(first?.occasionId)
    })
})
