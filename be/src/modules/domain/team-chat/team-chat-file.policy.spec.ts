import { Test } from "@nestjs/testing"
import {
    TEAM_CHAT_FILE_MAX_BYTES,
    extensionOf,
    fileNameOf,
    filePathOf,
    isAcceptedType,
    nameInPath,
    typeOfExtension,
} from "./team-chat-file.policy"

const SUBJECT = Symbol("team-chat-file.policy")

const WS = "11111111-1111-4111-8111-111111111111"
const ROOM = "22222222-2222-4222-8222-222222222222"
const ID = "33333333-3333-4333-8333-333333333333"

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { extensionOf, fileNameOf, filePathOf, isAcceptedType, nameInPath, typeOfExtension },
            },
        ],
    }).compile()
    return moduleRef.get<{
        extensionOf: typeof extensionOf
        fileNameOf: typeof fileNameOf
        filePathOf: typeof filePathOf
        isAcceptedType: typeof isAcceptedType
        nameInPath: typeof nameInPath
        typeOfExtension: typeof typeOfExtension
    }>(SUBJECT)
}

describe("team chat file policy", () => {
    it("accepts images, pdf, text and office files, up to 25 MB", async () => {
        const subject = await buildSubject()
        expect(subject.isAcceptedType("image/png")).toBe(true)
        expect(subject.isAcceptedType("application/pdf")).toBe(true)
        expect(subject.isAcceptedType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true)
        expect(subject.isAcceptedType("application/x-msdownload")).toBe(false)
        expect(TEAM_CHAT_FILE_MAX_BYTES).toBe(26_214_400)
    })

    it("keeps a safe name with the extension of its type and the type of a stored extension", async () => {
        const subject = await buildSubject()
        expect(subject.fileNameOf(String.raw`..\secret/Bao gia 2026.final.pdf`, "application/pdf")).toBe(
            "Bao gia 2026.final.pdf",
        )
        expect(subject.fileNameOf("a<b>c?.png", "image/png")).toBe("a_b_c_.png")
        expect(subject.fileNameOf("   ", "text/plain")).toBe("file.txt")
        expect(subject.fileNameOf("x".repeat(300), "image/jpeg")).toBe(`${"x".repeat(120)}.jpg`)
        expect(subject.fileNameOf("x", "application/octet-stream")).toBe("x.bin")
        expect(subject.typeOfExtension("pdf")).toBe("application/pdf")
        expect(subject.typeOfExtension("exe")).toBeNull()
        expect(subject.extensionOf("Bao gia.PDF")).toBe("pdf")
    })

    it("names the key of a file by workspace, room and id, and reads the name back only from a key of that room", async () => {
        const subject = await buildSubject()
        const path = subject.filePathOf(WS, ROOM, ID, "plan.pdf")
        expect(path).toBe(`${WS}/team-chat/${ROOM}/${ID}/plan.pdf`)
        expect(subject.nameInPath(WS, ROOM, path)).toBe("plan.pdf")
        expect(subject.nameInPath(WS, "44444444-4444-4444-8444-444444444444", path)).toBeNull()
        expect(subject.nameInPath("55555555-5555-4555-8555-555555555555", ROOM, path)).toBeNull()
        expect(subject.nameInPath(WS, ROOM, `${WS}/team-chat/${ROOM}/${ID}/a/b.pdf`)).toBeNull()
        expect(subject.nameInPath(WS, ROOM, "other")).toBeNull()
    })
})
