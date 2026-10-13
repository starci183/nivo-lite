import { DRIVE_MIME, driveReadMode, isDriveId, resolveLink } from "./drive-link.policy"

const ID = "1AbCdEfGhIjKlMnOp"

describe("driveReadMode", () => {
    it.each([
        [DRIVE_MIME.doc, "Notes", "doc"],
        [DRIVE_MIME.sheet, "Prices", "sheet"],
        [DRIVE_MIME.slides, "Deck", "slides"],
    ])("exports the Google type %s", (mimeType, name, mode) => {
        expect(driveReadMode(mimeType, name)).toBe(mode)
    })

    it("cannot read another Google-native type", () => {
        expect(driveReadMode("application/vnd.google-apps.form", "Form")).toBeNull()
    })

    it("downloads an uploaded file by its extension, whatever its type", () => {
        expect(driveReadMode("application/octet-stream", "Menu.PDF")).toBe("media")
    })

    it.each([
        "application/pdf",
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ])("downloads an uploaded file by its type %s", (mimeType) => {
        expect(driveReadMode(mimeType, "no-extension")).toBe("media")
    })

    it("cannot read an uploaded file of another type with another name", () => {
        expect(driveReadMode("image/png", "photo.png")).toBeNull()
    })
})

describe("resolveLink", () => {
    it.each(["not a link", "", "ftp://example.test/file"])("refuses %s", (raw) => {
        expect(resolveLink(raw)).toEqual({ kind: "invalid" })
    })

    it("leaves a plain page as it is and drops tracking parameters", () => {
        expect(resolveLink(" https://example.test/menu?utm_source=x&fbclid=y&page=2 ")).toEqual({
            kind: "web",
            fetchUrl: "https://example.test/menu?page=2",
        })
    })

    it("turns a Google Doc into its text export", () => {
        expect(resolveLink(`https://docs.google.com/document/d/${ID}/edit?usp=sharing`)).toEqual({
            kind: "google",
            driveId: ID,
            fetchUrl: `https://docs.google.com/document/d/${ID}/export?format=txt`,
        })
    })

    it("drops the account switch segment on Google hosts", () => {
        expect(resolveLink(`https://docs.google.com/u/2/document/d/${ID}/edit`)).toMatchObject({
            kind: "google",
            driveId: ID,
        })
    })

    it.each([
        ["in the fragment", `https://docs.google.com/spreadsheets/d/${ID}/edit#gid=77`, "&gid=77"],
        ["in the query", `https://docs.google.com/spreadsheets/d/${ID}/edit?gid=88`, "&gid=88"],
        ["missing", `https://docs.google.com/spreadsheets/d/${ID}/edit`, ""],
    ])("turns a Google Sheet into its CSV export with the tab %s", (_name, raw, tab) => {
        expect(resolveLink(raw)).toEqual({
            kind: "google",
            driveId: ID,
            fetchUrl: `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv${tab}`,
        })
    })

    it("turns Google Slides into their text export", () => {
        expect(resolveLink(`https://docs.google.com/presentation/d/${ID}/edit`)).toEqual({
            kind: "google",
            driveId: ID,
            fetchUrl: `https://docs.google.com/presentation/d/${ID}/export/txt`,
        })
    })

    it("treats any other Google Docs address as a page", () => {
        expect(resolveLink("https://docs.google.com/forms/d/short/edit")).toEqual({
            kind: "web",
            fetchUrl: "https://docs.google.com/forms/d/short/edit",
        })
    })

    it.each([
        [`https://drive.google.com/drive/folders/${ID}`, ID],
        ["https://drive.google.com/drive/my-drive", null],
    ])("recognises the Drive folder %s", (raw, folderId) => {
        expect(resolveLink(raw)).toEqual({ kind: "drive-folder", folderId })
    })

    it.each([
        `https://drive.google.com/file/d/${ID}/view`,
        `https://drive.google.com/open?id=${ID}`,
        `https://drive.google.com/uc?id=${ID}&export=download`,
    ])("recognises the Drive file %s", (raw) => {
        expect(resolveLink(raw)).toEqual({
            kind: "drive-file",
            driveId: ID,
            fetchUrl: `https://drive.google.com/uc?export=download&id=${ID}`,
        })
    })

    it.each([
        "https://drive.google.com/open?id=short",
        "https://drive.google.com/open",
        "https://drive.google.com/somewhere",
    ])("treats the Drive address %s that names no file as a page", (raw) => {
        expect(resolveLink(raw)).toEqual({ kind: "web", fetchUrl: raw })
    })
})

describe("isDriveId", () => {
    it("accepts the shape of a Drive id and refuses others", () => {
        expect(isDriveId(ID)).toBe(true)
        expect(isDriveId("short")).toBe(false)
        expect(isDriveId("has space in it!")).toBe(false)
    })
})
