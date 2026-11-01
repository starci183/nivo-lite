import { Test } from "@nestjs/testing"
import { DRIVE_MIME, driveFileUrl, driveReadMode, isDriveId, resolveLink } from "./drive-link.policy"

const SUBJECT = Symbol("drive-link.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { driveFileUrl, driveReadMode, isDriveId, resolveLink } }],
    }).compile()
    return moduleRef.get<
        Pick<typeof import("./drive-link.policy"), "driveFileUrl" | "driveReadMode" | "isDriveId" | "resolveLink">
    >(SUBJECT)
}

const ID = "1AbCdEfGhIjKlMnOp"

describe("driveReadMode", () => {
    it.each([
        [DRIVE_MIME.doc, "Notes", "doc"],
        [DRIVE_MIME.sheet, "Prices", "sheet"],
        [DRIVE_MIME.slides, "Deck", "slides"],
    ])("exports the Google type %s", async (mimeType, name, mode) => {
        const subject = await build()

        expect(subject.driveReadMode(mimeType, name)).toBe(mode)
    })

    it("cannot read another Google-native type", async () => {
        const subject = await build()

        expect(subject.driveReadMode("application/vnd.google-apps.form", "Form")).toBeNull()
    })

    it("downloads an uploaded file by its extension, whatever its type", async () => {
        const subject = await build()

        expect(subject.driveReadMode("application/octet-stream", "Menu.PDF")).toBe("media")
    })

    it.each([
        "application/pdf",
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ])("downloads an uploaded file by its type %s", async (mimeType) => {
        const subject = await build()

        expect(subject.driveReadMode(mimeType, "no-extension")).toBe("media")
    })

    it("cannot read an uploaded file of another type with another name", async () => {
        const subject = await build()

        expect(subject.driveReadMode("image/png", "photo.png")).toBeNull()
    })
})

describe("resolveLink", () => {
    it.each(["not a link", "", "ftp://example.test/file"])("refuses %s", async (raw) => {
        const subject = await build()

        expect(subject.resolveLink(raw)).toEqual({ kind: "invalid" })
    })
})

describe("resolveLink", () => {
    it("leaves a plain page as it is and drops tracking parameters", async () => {
        const subject = await build()

        expect(subject.resolveLink(" https://example.test/menu?utm_source=x&fbclid=y&page=2 ")).toEqual({
            kind: "web",
            fetchUrl: "https://example.test/menu?page=2",
        })
    })
})

describe("resolveLink", () => {
    it("turns a Google Doc into its text export", async () => {
        const subject = await build()

        expect(subject.resolveLink(`https://docs.google.com/document/d/${ID}/edit?usp=sharing`)).toEqual({
            kind: "google",
            driveId: ID,
            fetchUrl: `https://docs.google.com/document/d/${ID}/export?format=txt`,
        })
    })
})

describe("resolveLink", () => {
    it("drops the account switch segment on Google hosts", async () => {
        const subject = await build()

        expect(subject.resolveLink(`https://docs.google.com/u/2/document/d/${ID}/edit`)).toMatchObject({
            kind: "google",
            driveId: ID,
        })
    })
})

describe("resolveLink", () => {
    it.each([
        ["in the fragment", `https://docs.google.com/spreadsheets/d/${ID}/edit#gid=77`, "&gid=77"],
        ["in the query", `https://docs.google.com/spreadsheets/d/${ID}/edit?gid=88`, "&gid=88"],
        ["missing", `https://docs.google.com/spreadsheets/d/${ID}/edit`, ""],
    ])("turns a Google Sheet into its CSV export with the tab %s", async (_name, raw, tab) => {
        const subject = await build()

        expect(subject.resolveLink(raw)).toEqual({
            kind: "google",
            driveId: ID,
            fetchUrl: `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv${tab}`,
        })
    })
})

describe("resolveLink", () => {
    it("turns Google Slides into their text export", async () => {
        const subject = await build()

        expect(subject.resolveLink(`https://docs.google.com/presentation/d/${ID}/edit`)).toEqual({
            kind: "google",
            driveId: ID,
            fetchUrl: `https://docs.google.com/presentation/d/${ID}/export/txt`,
        })
    })
})

describe("resolveLink", () => {
    it("treats any other Google Docs address as a page", async () => {
        const subject = await build()

        expect(subject.resolveLink("https://docs.google.com/forms/d/short/edit")).toEqual({
            kind: "web",
            fetchUrl: "https://docs.google.com/forms/d/short/edit",
        })
    })
})

describe("resolveLink", () => {
    it.each([
        [`https://drive.google.com/drive/folders/${ID}`, ID],
        ["https://drive.google.com/drive/my-drive", null],
    ])("recognises the Drive folder %s", async (raw, folderId) => {
        const subject = await build()

        expect(subject.resolveLink(raw)).toEqual({ kind: "drive-folder", folderId })
    })
})

describe("resolveLink", () => {
    it.each([
        `https://drive.google.com/file/d/${ID}/view`,
        `https://drive.google.com/open?id=${ID}`,
        `https://drive.google.com/uc?id=${ID}&export=download`,
    ])("recognises the Drive file %s", async (raw) => {
        const subject = await build()

        expect(subject.resolveLink(raw)).toEqual({
            kind: "drive-file",
            driveId: ID,
            fetchUrl: `https://drive.google.com/uc?export=download&id=${ID}`,
        })
    })
})

describe("resolveLink", () => {
    it.each([
        "https://drive.google.com/open?id=short",
        "https://drive.google.com/open",
        "https://drive.google.com/somewhere",
    ])("treats the Drive address %s that names no file as a page", async (raw) => {
        const subject = await build()

        expect(subject.resolveLink(raw)).toEqual({ kind: "web", fetchUrl: raw })
    })
})

describe("driveFileUrl", () => {
    it.each([
        ["application/vnd.google-apps.document", "https://docs.google.com/document/d/ID/edit"],
        ["application/vnd.google-apps.spreadsheet", "https://docs.google.com/spreadsheets/d/ID/edit"],
        ["application/vnd.google-apps.presentation", "https://docs.google.com/presentation/d/ID/edit"],
        ["application/pdf", "https://drive.google.com/file/d/ID/view"],
        ["", "https://drive.google.com/file/d/ID/view"],
    ])("opens a file of type %j at %s", async (mimeType, expected) => {
        const subject = await build()

        expect(subject.driveFileUrl("ID", mimeType)).toBe(expected)
    })
})

describe("isDriveId", () => {
    it("accepts the shape of a Drive id and refuses others", async () => {
        const subject = await build()

        expect(subject.isDriveId(ID)).toBe(true)
        expect(subject.isDriveId("short")).toBe(false)
        expect(subject.isDriveId("has space in it!")).toBe(false)
    })
})
