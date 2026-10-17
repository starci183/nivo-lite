import { Test } from "@nestjs/testing"
import {
    CONTENT_MEDIA_MAX_BYTES,
    isAcceptedMedia,
    buildContentMediaPath,
    displayName,
    isListableMedia,
    isWorkspaceMediaPath,
    withDownloadUrl,
} from "./media.policy"

const SUBJECT = Symbol("media.policy")
type Subject = {
    isAcceptedMedia: typeof isAcceptedMedia
    buildContentMediaPath: typeof buildContentMediaPath
    displayName: typeof displayName
    isListableMedia: typeof isListableMedia
    isWorkspaceMediaPath: typeof isWorkspaceMediaPath
    withDownloadUrl: typeof withDownloadUrl
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isAcceptedMedia,
                    buildContentMediaPath,
                    displayName,
                    isListableMedia,
                    isWorkspaceMediaPath,
                    withDownloadUrl,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const file = { name: "Tea.jpg", contentType: "image/jpeg", sizeBytes: 1024 }

describe("isAcceptedMedia", () => {
    it("accepts a named picture or mp4 within the size limit", async () => {
        const subject = await buildSubject()
        expect(subject.isAcceptedMedia(file)).toBe(true)
        expect(subject.isAcceptedMedia({ ...file, contentType: "image/png", name: "a.png" })).toBe(true)
        expect(subject.isAcceptedMedia({ ...file, contentType: "image/webp", name: "a.webp" })).toBe(true)
        expect(subject.isAcceptedMedia({ ...file, contentType: "video/mp4", name: "a.mp4" })).toBe(true)
    })

    it.each([
        ["a blank name", { ...file, name: "   " }],
        ["a name over 255 characters", { ...file, name: "a".repeat(256) }],
        ["a fractional size", { ...file, sizeBytes: 1.5 }],
        ["a zero size", { ...file, sizeBytes: 0 }],
        ["a size over ten megabytes", { ...file, sizeBytes: CONTENT_MEDIA_MAX_BYTES + 1 }],
        ["a type the workbench does not store", { ...file, contentType: "image/gif" }],
    ])("refuses %s", async (_label, candidate) => {
        const subject = await buildSubject()
        expect(subject.isAcceptedMedia(candidate)).toBe(false)
    })
})

describe("buildContentMediaPath", () => {
    it("keeps an ascii stem and a short extension", async () => {
        const subject = await buildSubject()
        expect(subject.buildContentMediaPath("ws-1", "Summer Tea.JPG", "obj-1")).toBe("ws-1/obj-1-Summer-Tea.jpg")
    })

    it("folds Vietnamese letters, drops marks, and falls back when the stem vanishes", async () => {
        const subject = await buildSubject()
        expect(subject.buildContentMediaPath("ws-1", "\u0110\u1ed3 u\u1ed1ng!.png", "obj-1")).toBe(
            "ws-1/obj-1-do-uong.png",
        )
        expect(subject.buildContentMediaPath("ws-1", "---.png", "obj-1")).toBe("ws-1/obj-1-file.png")
    })

    it("drops an extension that is only punctuation and a leading dot", async () => {
        const subject = await buildSubject()
        expect(subject.buildContentMediaPath("ws-1", "notes.!!!", "obj-1")).toBe("ws-1/obj-1-notes")
        expect(subject.buildContentMediaPath("ws-1", ".hidden", "obj-1")).toBe("ws-1/obj-1-hidden")
    })

    it("bounds the stem at 40 characters and the extension at 5", async () => {
        const subject = await buildSubject()
        const stem = "a".repeat(50)
        expect(subject.buildContentMediaPath("ws-1", `${stem}.jpegextra`, "obj-1")).toBe(
            `ws-1/obj-1-${"a".repeat(40)}.jpege`,
        )
    })

    it("uses the whole name when there is no extension", async () => {
        const subject = await buildSubject()
        expect(subject.buildContentMediaPath("ws-1", "readme", "obj-1")).toBe("ws-1/obj-1-readme")
    })

    it("uses the fallback stem for an entirely punctuation-only name", async () => {
        const subject = await buildSubject()
        expect(subject.buildContentMediaPath("ws-1", "!!!", "obj-1")).toBe("ws-1/obj-1-file")
    })
})

describe("displayName", () => {
    it("removes a generated uuid prefix and leaves a plain name", async () => {
        const subject = await buildSubject()
        expect(subject.displayName("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-Tea.jpg")).toBe("Tea.jpg")
        expect(subject.displayName("Tea.jpg")).toBe("Tea.jpg")
    })
})

describe("isListableMedia", () => {
    it.each(["a.jpg", "a.jpeg", "a.PNG", "a.webp", "a.mp4", "a.MOV", "a.webm"])("lists %s", async (name) => {
        const subject = await buildSubject()
        expect(subject.isListableMedia(name)).toBe(true)
    })

    it("skips a file the workbench cannot show", async () => {
        const subject = await buildSubject()
        expect(subject.isListableMedia("notes.txt")).toBe(false)
    })
})

describe("isWorkspaceMediaPath", () => {
    it("accepts a path inside the workspace folder", async () => {
        const subject = await buildSubject()
        expect(subject.isWorkspaceMediaPath("ws-1", "ws-1/obj-1-Tea.jpg")).toBe(true)
    })

    it.each([
        ["an empty workspace", "", "ws-1/a.jpg"],
        ["a workspace id that contains a slash", "ws/1", "ws/1/a.jpg"],
        ["a path of another workspace", "ws-1", "ws-2/a.jpg"],
        ["an encoded percent", "ws-1", "ws-1/%2e%2e/a.jpg"],
        ["a backslash", "ws-1", "ws-1\\a.jpg"],
        ["a control character", "ws-1", "ws-1/a\u0000.jpg"],
        ["an empty segment", "ws-1", "ws-1//a.jpg"],
        ["a dot segment", "ws-1", "ws-1/./a.jpg"],
        ["a parent segment", "ws-1", "ws-1/../a.jpg"],
    ])("refuses %s", async (_label, workspaceId, path) => {
        const subject = await buildSubject()
        expect(subject.isWorkspaceMediaPath(workspaceId, path)).toBe(false)
    })
})

describe("withDownloadUrl", () => {
    it("adds the download name with the right separator", async () => {
        const subject = await buildSubject()
        expect(subject.withDownloadUrl("https://cdn.example/file", "Tr\u00e0.jpg")).toBe(
            "https://cdn.example/file?download=Tr%C3%A0.jpg",
        )
        expect(subject.withDownloadUrl("https://cdn.example/file?token=1", "Tea.jpg")).toBe(
            "https://cdn.example/file?token=1&download=Tea.jpg",
        )
    })
})
