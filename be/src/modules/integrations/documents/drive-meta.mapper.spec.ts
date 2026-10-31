import { Test } from "@nestjs/testing"
import { metaFrom, fileOf, joined } from "./drive-meta.mapper"

const SUBJECT = Symbol("drive-meta.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { metaFrom, fileOf, joined } }],
    }).compile()
    return moduleRef.get<typeof import("./drive-meta.mapper")>(SUBJECT)
}

describe("metaFrom", () => {
    it("reads the fields of a Drive answer", async () => {
        const subject = await build()

        expect(
            subject.metaFrom({
                id: "a",
                name: "n",
                mimeType: "m",
                size: "12",
                modifiedTime: "t",
                trashed: true,
                shortcutDetails: { targetId: "x" },
            }),
        ).toEqual({ id: "a", name: "n", mimeType: "m", size: "12", modifiedTime: "t", trashed: true, targetId: "x" })
    })

    it("leaves out whatever is missing or of the wrong type", async () => {
        const subject = await build()

        expect(subject.metaFrom({ id: 5, trashed: "yes" })).toEqual({
            id: undefined,
            name: undefined,
            mimeType: undefined,
            size: undefined,
            modifiedTime: undefined,
            trashed: false,
            targetId: undefined,
        })
        expect(subject.metaFrom(null).id).toBeUndefined()
    })
})

describe("fileOf", () => {
    it("lists a file under the id and path it was found at", async () => {
        const subject = await build()

        expect(
            subject.fileOf(
                subject.metaFrom({ name: "a.txt", mimeType: "text/plain", size: "5", modifiedTime: "t" }),
                "id1",
                "x/y",
            ),
        ).toEqual({
            id: "id1",
            name: "a.txt",
            mimeType: "text/plain",
            url: "https://drive.google.com/file/d/id1/view",
            size: 5,
            modifiedTime: "t",
            path: "x/y",
        })
    })

    it("falls back to the id as the name and to empty values", async () => {
        const subject = await build()

        expect(subject.fileOf(subject.metaFrom({}), "id1", "")).toEqual({
            id: "id1",
            name: "id1",
            mimeType: "",
            url: "https://drive.google.com/file/d/id1/view",
            size: null,
            modifiedTime: null,
            path: "",
        })
    })
})

describe("joined", () => {
    it("adds a folder name to a path, with no leading slash at the top", async () => {
        const subject = await build()

        expect(subject.joined("", "a")).toBe("a")
        expect(subject.joined("a", "b")).toBe("a/b")
    })
})
