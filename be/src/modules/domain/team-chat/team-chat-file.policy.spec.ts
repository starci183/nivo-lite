import {
    TEAM_CHAT_FILE_MAX_BYTES,
    extensionOf,
    fileNameOf,
    filePathOf,
    isAcceptedType,
    nameInPath,
    typeOfExtension,
} from "./team-chat-file.policy"

const WS = "11111111-1111-4111-8111-111111111111"
const ROOM = "22222222-2222-4222-8222-222222222222"
const ID = "33333333-3333-4333-8333-333333333333"

describe("team chat file policy", () => {
    it("accepts images, pdf, text and office files, up to 25 MB", () => {
        expect(isAcceptedType("image/png")).toBe(true)
        expect(isAcceptedType("application/pdf")).toBe(true)
        expect(isAcceptedType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true)
        expect(isAcceptedType("application/x-msdownload")).toBe(false)
        expect(TEAM_CHAT_FILE_MAX_BYTES).toBe(26_214_400)
    })

    it("keeps a safe name with the extension of its type and the type of a stored extension", () => {
        expect(fileNameOf("..\\secret/Bao gia 2026.final.pdf", "application/pdf")).toBe("Bao gia 2026.final.pdf")
        expect(fileNameOf("a<b>c?.png", "image/png")).toBe("a_b_c_.png")
        expect(fileNameOf("   ", "text/plain")).toBe("file.txt")
        expect(fileNameOf("x".repeat(300), "image/jpeg")).toBe(`${"x".repeat(120)}.jpg`)
        expect(fileNameOf("x", "application/octet-stream")).toBe("x.bin")
        expect(typeOfExtension("pdf")).toBe("application/pdf")
        expect(typeOfExtension("exe")).toBeNull()
        expect(extensionOf("Bao gia.PDF")).toBe("pdf")
    })

    it("names the key of a file by workspace, room and id, and reads the name back only from a key of that room", () => {
        const path = filePathOf(WS, ROOM, ID, "plan.pdf")
        expect(path).toBe(`${WS}/team-chat/${ROOM}/${ID}/plan.pdf`)
        expect(nameInPath(WS, ROOM, path)).toBe("plan.pdf")
        expect(nameInPath(WS, "44444444-4444-4444-8444-444444444444", path)).toBeNull()
        expect(nameInPath("55555555-5555-4555-8555-555555555555", ROOM, path)).toBeNull()
        expect(nameInPath(WS, ROOM, `${WS}/team-chat/${ROOM}/${ID}/a/b.pdf`)).toBeNull()
        expect(nameInPath(WS, ROOM, "other")).toBeNull()
    })
})
