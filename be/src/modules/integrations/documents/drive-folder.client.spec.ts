import type { Logger } from "@modules/platform/logging"
import { DocumentsLogEvent } from "./documents.log-events"
import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { HttpClient, HttpResponse } from "@modules/platform/http"
import type { DocumentReaders } from "./documents.contracts"
import { DOCUMENTS_OPTIONS } from "./documents.decorators"
import type { DocumentsOptions } from "./documents.options"
import { DocumentsHttpClient } from "./documents-http.client"
import { DriveApiClient } from "./drive-api.client"
import { DriveFolderClient } from "./drive-folder.client"
import { metaFrom } from "./drive-meta.mapper"
import { DocumentsError, DocumentsErrorCode } from "./errors/documents.error"

const optionsOf = builder<DocumentsOptions>({
    driveBase: "https://drive.test/v3",
    oauthBase: null,
    google: null,
    readers: mock<DocumentReaders>(),
})

const json = (value: unknown, status = 200): HttpResponse => ({
    status,
    headers: {},
    url: "",
    body: Buffer.from(JSON.stringify(value)),
})

const failure = (status: number): HttpResponse => ({ status, headers: {}, url: "", body: Buffer.from("") })

type Route = readonly [match: string, response: HttpResponse]

const build = async () => {
    const options = builder<DocumentsOptions>(optionsOf())()
    const http = mock<HttpClient>()
    const logger: Logger = mock<Logger>()
    const transport = mock<DocumentsHttpClient>({
        get: jest.fn((url: string, headers: Readonly<Record<string, string>>, timeoutMs: number) =>
            http.request({ method: "GET", url, headers, read: "bytes", timeoutMs }),
        ),
        postForm: jest.fn((url: string, form: Readonly<Record<string, string>>, timeoutMs: number) =>
            http.request({ method: "POST", url, form, read: "bytes", timeoutMs }),
        ),
        jsonBody: jest.fn((response: HttpResponse): unknown => {
            try {
                return JSON.parse(
                    new TextDecoder().decode(response.body instanceof Uint8Array ? response.body : new Uint8Array()),
                )
            } catch (cause) {
                logger.error(DocumentsLogEvent.BodyUnreadable, cause, { status: response.status })
                return undefined
            }
        }),
    })
    const api = mock<DriveApiClient>()
    api.get.mockImplementation(async (token, url) => {
        const response = await transport.get(url, { Authorization: `Bearer ${token}` }, 30_000)
        if (response.status === 401) throw new DocumentsError({ code: DocumentsErrorCode.TokenRejected })
        if (response.status >= 400) throw new DocumentsError({ code: DocumentsErrorCode.DriveNoAccess })
        return response
    })
    api.metaOf.mockImplementation(async (token, id) =>
        metaFrom(
            transport.jsonBody(
                await api.get(
                    token,
                    `https://drive.test/v3/files/${id}?fields=id,name,mimeType,size,modifiedTime,trashed,` +
                        "shortcutDetails(targetId)&supportsAllDrives=true",
                ),
            ),
        ),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            DriveFolderClient,
            { provide: DriveApiClient, useValue: api },
            { provide: DOCUMENTS_OPTIONS, useValue: options },
            { provide: DocumentsHttpClient, useValue: transport },
        ],
    }).compile()
    const route = (table: ReadonlyArray<Route>): void => {
        http.request.mockImplementation((request) => {
            const hit = table.find(([match]) => request.url.includes(match))
            return hit === undefined ? Promise.reject(new Error(`unrouted ${request.url}`)) : Promise.resolve(hit[1])
        })
    }
    return { client: moduleRef.get(DriveFolderClient), http, route }
}

const FOLDER_ID = "1FolderFolderFolder"
const FOLDER = "application/vnd.google-apps.folder"
const SHORTCUT = "application/vnd.google-apps.shortcut"
const ROOT = [`/files/${FOLDER_ID}?fields`, json({ name: "Shop", mimeType: FOLDER })] as const
const item = (id: string, name: string, mimeType: string, extra: object = {}) => ({ id, name, mimeType, ...extra })
const childrenOf = (id: string): string => encodeURIComponent(`'${id}' in parents`)

describe("DriveFolderClient", () => {
    it("refuses a malformed id and a root that is not a folder", async () => {
        const { client, route } = await build()
        route([[`/files/${FOLDER_ID}?fields`, json({ name: "Doc", mimeType: "text/plain" })]])

        await expect(client.listFolder("token-1", "short")).rejects.toMatchObject({
            code: DocumentsErrorCode.DriveIdInvalid,
        })
        await expect(client.listFolder("token-1", FOLDER_ID)).rejects.toMatchObject({
            code: DocumentsErrorCode.NotFolder,
        })
    })
})

describe("DriveFolderClient", () => {
    it("lists the files of the folder and the folders below it with their paths", async () => {
        const { client, route } = await build()
        route([
            ROOT,
            [
                childrenOf(FOLDER_ID),
                json({
                    files: [
                        item("1FileFileFileFile1", "menu.pdf", "application/pdf", {
                            size: "12",
                            modifiedTime: "2026-01-01",
                        }),
                        item("1SubSubSubSubSub11", "Menus", FOLDER),
                        { name: "no id", mimeType: "text/plain" },
                        item("1FileFileFileFile1", "menu.pdf", "application/pdf"),
                        { id: "1NoNameNoNameNoN1" },
                    ],
                }),
            ],
            [
                childrenOf("1SubSubSubSubSub11"),
                json({ files: [item(FOLDER_ID, "Loop", FOLDER), item("1DeepDeepDeepDee1", "deep.txt", "text/plain")] }),
            ],
        ])

        const listing = await client.listFolder("token-1", FOLDER_ID)

        expect(listing.name).toBe("Shop")
        expect(listing.truncated).toBe(false)
        expect(listing.files.map((file) => [file.name, file.path, file.size])).toEqual([
            ["menu.pdf", "", 12],
            ["1NoNameNoNameNoN1", "", null],
            ["deep.txt", "Menus", null],
        ])
    })
})

describe("DriveFolderClient", () => {
    it("uses the id as the name of a folder with none and keeps paging while Drive sends a page token", async () => {
        const { client, http } = await build()
        http.request.mockImplementation((request) => {
            if (request.url.includes(`/files/${FOLDER_ID}?fields`)) return Promise.resolve(json({ mimeType: FOLDER }))
            if (request.url.includes("pageToken=next%201")) {
                return Promise.resolve(json({ files: [item("1FileFileFileFile2", "b.txt", "text/plain")] }))
            }
            return Promise.resolve(
                json({ files: [item("1FileFileFileFile1", "a.txt", "text/plain")], nextPageToken: "next 1" }),
            )
        })

        const listing = await client.listFolder("token-1", FOLDER_ID)

        expect(listing.name).toBe(FOLDER_ID)
        expect(listing.files.map((file) => file.name)).toEqual(["a.txt", "b.txt"])
    })
})

describe("DriveFolderClient", () => {
    it("follows shortcuts to files and folders, and skips the ones that cannot be followed", async () => {
        const { client, route } = await build()
        const shortcut = (id: string, name: string | undefined, targetId: string | undefined) => ({
            id,
            ...(name === undefined ? {} : { name }),
            mimeType: SHORTCUT,
            shortcutDetails: targetId === undefined ? {} : { targetId },
        })
        route([
            ROOT,
            [
                childrenOf(FOLDER_ID),
                json({
                    files: [
                        shortcut("1ShortShortShort01", "to file", "1TargetFileFile001"),
                        shortcut("1ShortShortShort02", "to folder", "1TargetFolderFold02"),
                        shortcut("1ShortShortShort03", undefined, "1TargetFolderFold03"),
                        shortcut("1ShortShortShort04", "trashed", "1TargetTrashed00004"),
                        shortcut("1ShortShortShort05", "no target", undefined),
                        shortcut("1ShortShortShort06", "bad target", "bad"),
                        shortcut("1ShortShortShort07", "missing", "1TargetMissing00007"),
                    ],
                }),
            ],
            ["/files/1TargetFileFile001?fields", json({ name: "real.txt", mimeType: "text/plain" })],
            ["/files/1TargetFolderFold02?fields", json({ name: "Real dir", mimeType: FOLDER })],
            ["/files/1TargetFolderFold03?fields", json({ name: "Third dir", mimeType: FOLDER })],
            ["/files/1TargetTrashed00004?fields", json({ name: "gone", mimeType: "text/plain", trashed: true })],
            ["/files/1TargetMissing00007?fields", failure(404)],
            [childrenOf("1TargetFolderFold02"), json({ files: [] })],
            [childrenOf("1TargetFolderFold03"), json({ files: [] })],
        ])

        const listing = await client.listFolder("token-1", FOLDER_ID)

        expect(listing.files.map((file) => file.name)).toEqual(["real.txt"])
    })
})

describe("DriveFolderClient", () => {
    it("skips a shortcut whose lookup fails for any reason and names unnamed folders by their id", async () => {
        const { client, http } = await build()
        http.request.mockImplementation((request) => {
            if (request.url.includes(`/files/${FOLDER_ID}?fields`)) {
                return Promise.resolve(json({ name: "Shop", mimeType: FOLDER }))
            }
            if (request.url.includes("/files/1TargetBoom0000008?fields"))
                return Promise.reject(new Error("socket hang up"))
            if (request.url.includes("/files/1TargetFolderFold09?fields"))
                return Promise.resolve(json({ mimeType: FOLDER }))
            if (request.url.includes(childrenOf(FOLDER_ID))) {
                return Promise.resolve(
                    json({
                        files: [
                            {
                                id: "1ShortShortShort08",
                                mimeType: SHORTCUT,
                                shortcutDetails: { targetId: "1TargetBoom0000008" },
                            },
                            {
                                id: "1ShortShortShort09",
                                mimeType: SHORTCUT,
                                shortcutDetails: { targetId: "1TargetFolderFold09" },
                            },
                            { id: "1UnnamedFolder0001", mimeType: FOLDER },
                        ],
                    }),
                )
            }
            return Promise.resolve(json({ files: [item("1InsideFileFile001", "in.txt", "text/plain")] }))
        })

        const listing = await client.listFolder("token-1", FOLDER_ID)

        expect(listing.files.map((file) => [file.name, file.path])).toEqual([["in.txt", "1TargetFolderFold09"]])
    })
})

describe("DriveFolderClient", () => {
    it("does not swallow a rejected token met while following a shortcut", async () => {
        const { client, route } = await build()
        route([
            ROOT,
            [
                childrenOf(FOLDER_ID),
                json({
                    files: [
                        {
                            id: "1ShortShortShort01",
                            mimeType: SHORTCUT,
                            shortcutDetails: { targetId: "1TargetFileFile001" },
                        },
                    ],
                }),
            ],
            ["/files/1TargetFileFile001?fields", failure(401)],
        ])

        await expect(client.listFolder("token-1", FOLDER_ID)).rejects.toMatchObject({
            code: DocumentsErrorCode.TokenRejected,
        })
    })
})

describe("DriveFolderClient", () => {
    it("stops following shortcuts after fifty lookups", async () => {
        const { client, http } = await build()
        const shortcuts = Array.from({ length: 52 }, (_, index) => ({
            id: `1ShortCut${String(index).padStart(8, "0")}`,
            mimeType: SHORTCUT,
            shortcutDetails: { targetId: `1TargetFile${String(index).padStart(7, "0")}` },
        }))
        http.request.mockImplementation((request) => {
            if (request.url.includes(`/files/${FOLDER_ID}?fields`)) {
                return Promise.resolve(json({ name: "Shop", mimeType: FOLDER }))
            }
            if (request.url.includes(childrenOf(FOLDER_ID))) return Promise.resolve(json({ files: shortcuts }))
            return Promise.resolve(json({ name: "t.txt", mimeType: "text/plain" }))
        })

        const listing = await client.listFolder("token-1", FOLDER_ID)

        expect(listing.files).toHaveLength(50)
    })
})

describe("DriveFolderClient", () => {
    it("marks the listing truncated when folders nest deeper than the limit", async () => {
        const { client, http } = await build()
        http.request.mockImplementation((request) => {
            if (request.url.includes(`/files/${FOLDER_ID}?fields`)) {
                return Promise.resolve(json({ name: "Shop", mimeType: FOLDER }))
            }
            const parent = /'(\w+)'%20in%20parents/u.exec(request.url)?.[1] ?? ""
            const depth = parent === FOLDER_ID ? 0 : Number(parent.slice(-1))
            return Promise.resolve(
                json({ files: [item(`1DeepFolder00000000${depth + 1}`, `level ${depth + 1}`, FOLDER)] }),
            )
        })

        const listing = await client.listFolder("token-1", FOLDER_ID)

        expect(listing.truncated).toBe(true)
    })
})

describe("DriveFolderClient", () => {
    it("marks the listing truncated at the file limit and lists nothing after it", async () => {
        const { client, http } = await build()
        const files = [
            item("1SubFolderSubFold01", "Sub", FOLDER),
            ...Array.from({ length: 301 }, (_, index) =>
                item(`1ManyFiles${String(index).padStart(8, "0")}`, `f${index}.txt`, "text/plain"),
            ),
        ]
        http.request.mockImplementation((request) =>
            Promise.resolve(
                request.url.includes(`/files/${FOLDER_ID}?fields`)
                    ? json({ name: "Shop", mimeType: FOLDER })
                    : json({ files }),
            ),
        )

        const listing = await client.listFolder("token-1", FOLDER_ID)

        expect(listing.files).toHaveLength(300)
        expect(listing.truncated).toBe(true)
    })
})
