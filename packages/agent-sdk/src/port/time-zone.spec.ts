import { DEFAULT_TIME_ZONE } from "./index"

describe("the default time zone", () => {
    it("is a zone the runtime knows", () => {
        expect(DEFAULT_TIME_ZONE).toBe("Asia/Ho_Chi_Minh")
        expect(() => new Intl.DateTimeFormat("en", { timeZone: DEFAULT_TIME_ZONE })).not.toThrow()
    })
})
