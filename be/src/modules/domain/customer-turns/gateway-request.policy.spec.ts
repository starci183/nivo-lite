import { hotelDetailOf, readHotelRequest, roomOfText } from "./gateway-request.policy"

describe("hotel-request.policy", () => {
    it("reads a bounded hotel request", () => {
        const request = readHotelRequest({
            intent: "spa_hold",
            service: " massage-60 ",
            date: "2026-10-24",
            time: "9:30",
            party_size: 2.4,
            nights: 99,
            room_type: "deluxe",
            contact_name: "Lan",
            phone: "0900",
            discount_pct: 15,
        })
        expect(request).toEqual({
            intent: "spa_hold",
            service: "massage-60",
            date: "2026-10-24",
            time: "09:30",
            partySize: 2,
            nights: 30,
            roomType: "deluxe",
            name: "Lan",
            phone: "0900",
            discountPct: 15,
        })
        expect(hotelDetailOf(request)).toEqual({
            intent: "spa_hold",
            service: "massage-60",
            date: "2026-10-24",
            time: "09:30",
            party_size: 2,
            nights: 30,
            room_type: "deluxe",
            contact_name: "Lan",
            phone: "0900",
            discount_pct: 15,
        })
    })

    it("drops malformed members and refuses unknown intents", () => {
        expect(
            readHotelRequest({
                intent: "room_search",
                date: "24/10",
                time: "25:00",
                party_size: 0,
                discount_pct: 150,
                service: 3,
            }),
        ).toEqual({
            intent: "room_search",
            service: "",
            date: null,
            time: null,
            partySize: 1,
            nights: 1,
            roomType: "",
            name: "",
            phone: null,
            discountPct: null,
        })
        expect(readHotelRequest({ intent: "spa_hold", discount_pct: "10" })?.discountPct).toBeNull()
        expect(readHotelRequest({ intent: "fly" })).toBeNull()
        expect(readHotelRequest([])).toBeNull()
        expect(readHotelRequest(null)).toBeNull()
        expect(hotelDetailOf(null)).toBeNull()
    })

    it("reads the room a front-desk line names", () => {
        expect(roomOfText("@ai-cskh phòng 302 khách xin nhận sớm")).toBe("302")
        expect(roomOfText("P.1205 early please")).toBe("1205")
        expect(roomOfText("phong 12a")).toBe("12a")
        expect(roomOfText("khách xin nhận sớm")).toBeNull()
    })
})
