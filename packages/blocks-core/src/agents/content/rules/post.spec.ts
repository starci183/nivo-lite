import { isContentChannel, publishResultShape, wallTimeOf } from "./post"

describe("content items", () => {
    it("knows the channels", () => {
        expect(isContentChannel("zalo")).toBe(true)
        expect(isContentChannel("youtube")).toBe(false)
        expect(isContentChannel(3)).toBe(false)
    })

    it("reads a wall-clock time and refuses one that is none", () => {
        expect(wallTimeOf(" 19:30 ")).toBe("19:30")
        expect(wallTimeOf("24:00")).toBeNull()
        expect(wallTimeOf("7:30")).toBeNull()
    })

    it("keeps a publish result with or without the channel's ids", () => {
        expect(publishResultShape.safeParse({ postId: "p1", url: null }).success).toBe(true)
        expect(publishResultShape.safeParse({ postId: 1, url: null }).success).toBe(false)
    })
})
