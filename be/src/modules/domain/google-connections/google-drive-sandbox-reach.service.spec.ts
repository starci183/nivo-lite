import { readFileSync } from "node:fs"
import { mock } from "@starci/jest-preset"
import { ProviderSandboxErrorCode, SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { DocumentsErrorCode } from "@modules/integrations/documents"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { DriveLiveReachService } from "./drive-live-reach.service"
import { DriveProviderRegistrationService } from "./drive-provider-registration.service"
import { DriveReachRegistryService } from "./drive-reach-registry.service"
import {
    GOOGLE_DRIVE_CASE,
    GOOGLE_DRIVE_SANDBOX_CASES,
    GOOGLE_DRIVE_SANDBOX_CATALOGUE,
    GOOGLE_DRIVE_SANDBOX_FILES,
    GOOGLE_DRIVE_SANDBOX_LISTING,
} from "./google-drive-sandbox.catalogue"
import { GoogleDriveSandboxReachService } from "./google-drive-sandbox-reach.service"

const ACCOUNT = sandboxAccount({ id: "drv-sbx", workspaceId: "ws-1", provider: "google_drive" })
const CONNECTION = connectionRecord({ id: "drv-sbx", workspaceId: "ws-1", provider: "google_drive", sandbox: true })
const LIVE_CONNECTION = connectionRecord({ id: "drv-live", workspaceId: "ws-1", provider: "google_drive" })

const setup = () => {
    const { sandbox } = sandboxServiceOf(ACCOUNT)
    return { sandbox, service: new GoogleDriveSandboxReachService(sandbox) }
}

/** The failure a promise rejects with, or null when it resolves. */
const failureOf = (work: Promise<unknown>): Promise<unknown> => work.then(() => null, (cause: unknown) => cause)

describe("GoogleDriveSandboxReachService / grant", () => {
    it("GOOGLE_DRIVE-1 is the default: the grant is connected, and one grant call is logged", async () => {
        const { sandbox, service } = setup()

        await expect(service.grant(CONNECTION)).resolves.toBe("connected")

        expect(await sandbox.calls(ACCOUNT, "grant")).toHaveLength(1)
    })

    it.each([
        [GOOGLE_DRIVE_CASE.notGranted, "none"],
        [GOOGLE_DRIVE_CASE.grantLost, "lost"],
    ] as const)("%s answers the grant %s", async (caseId, expected) => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "grant", caseId)

        await expect(service.grant(CONNECTION)).resolves.toBe(expected)
    })
})

describe("GoogleDriveSandboxReachService / listFolder", () => {
    it("GOOGLE_DRIVE-4 is the default: the sandbox folder's three files, whatever folder id is asked, one list call logged under the id", async () => {
        const { sandbox, service } = setup()

        const listing = await service.listFolder(CONNECTION, "any-folder")

        expect(listing).toBe(GOOGLE_DRIVE_SANDBOX_LISTING)
        expect(listing.files.map((file) => file.name)).toEqual(["Bang gia 2026", "Chinh sach doi tra.pdf", "Ton kho thang 11"])
        expect(listing.truncated).toBe(false)
        const calls = await sandbox.calls(ACCOUNT, "list")
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({ key: "any-folder", request: { folderId: "any-folder" } })
    })

    it("GOOGLE_DRIVE-5 is an empty folder and GOOGLE_DRIVE-6 a listing the limits cut", async () => {
        const { sandbox, service } = setup()

        await sandbox.setNextCase(ACCOUNT, "list", GOOGLE_DRIVE_CASE.emptyFolder)
        await expect(service.listFolder(CONNECTION, "f")).resolves.toMatchObject({ files: [], truncated: false })
        await sandbox.setNextCase(ACCOUNT, "list", GOOGLE_DRIVE_CASE.truncated)
        await expect(service.listFolder(CONNECTION, "f")).resolves.toMatchObject({ truncated: true })
    })

    it.each([
        [GOOGLE_DRIVE_CASE.listTokenRejected, DocumentsErrorCode.TokenRejected],
        [GOOGLE_DRIVE_CASE.listNoAccess, DocumentsErrorCode.DriveNoAccess],
        [GOOGLE_DRIVE_CASE.listUnavailable, DocumentsErrorCode.Unavailable],
        [GOOGLE_DRIVE_CASE.listGrantLost, DocumentsErrorCode.DriveGrantLost],
    ])("%s throws the documents error %s every time (sticky)", async (caseId, code) => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "list", caseId)

        for (let round = 0; round < 2; round += 1) {
            await expect(failureOf(service.listFolder(CONNECTION, "f"))).resolves.toMatchObject({ code })
        }
        const calls = await sandbox.calls(ACCOUNT, "list")
        expect(calls).toHaveLength(2)
        expect(calls[0]?.result.outcome).toBe("threw")
    })
})

describe("GoogleDriveSandboxReachService / readFile", () => {
    it("GOOGLE_DRIVE-11 is the default: a file the sandbox Drive holds answers its name and text", async () => {
        const { service } = setup()

        await expect(service.readFile(CONNECTION, "sbx-drive-prices")).resolves.toEqual({
            name: "Bang gia 2026",
            text: expect.stringContaining("Goi co ban: 500.000"),
        })
        await expect(service.readFile(CONNECTION, "sbx-drive-stock")).resolves.toMatchObject({ name: "Ton kho thang 11" })
    })

    it("an id the sandbox Drive holds nothing under is refused as a file the account cannot open (Drive's 404)", async () => {
        const { service } = setup()

        await expect(failureOf(service.readFile(CONNECTION, "unknown-id"))).resolves.toMatchObject({ code: DocumentsErrorCode.DriveNoAccess })
    })

    it.each([
        [GOOGLE_DRIVE_CASE.tooLarge, DocumentsErrorCode.TooLarge, { maxMb: 10 }],
        [GOOGLE_DRIVE_CASE.typeUnsupported, DocumentsErrorCode.TypeUnsupported, { type: "application/zip" }],
        [GOOGLE_DRIVE_CASE.readNoAccess, DocumentsErrorCode.DriveNoAccess, {}],
        [GOOGLE_DRIVE_CASE.readUnavailable, DocumentsErrorCode.Unavailable, {}],
    ])("%s throws the documents error %s, whatever file is asked (the request never picks the case)", async (caseId, code, params) => {
        const { sandbox, service } = setup()
        await sandbox.setNextCase(ACCOUNT, "read", caseId)

        for (const file of GOOGLE_DRIVE_SANDBOX_FILES) {
            await expect(failureOf(service.readFile(CONNECTION, file.id))).resolves.toMatchObject({ code, params })
        }
    })
})

describe("the Drive sandbox as a whole", () => {
    it("is deterministic: a fresh account answers the same", async () => {
        const first = setup()
        const second = setup()

        await expect(first.service.listFolder(CONNECTION, "f")).resolves.toEqual(await second.service.listFolder(CONNECTION, "f"))
        await expect(first.service.readFile(CONNECTION, "sbx-drive-returns")).resolves.toEqual(await second.service.readFile(CONNECTION, "sbx-drive-returns"))
    })

    it("refuses a live account and a switched-off sandbox, on every operation", async () => {
        const { service } = setup()
        const off = new GoogleDriveSandboxReachService(sandboxServiceOff(ACCOUNT).sandbox)

        await expect(service.grant(LIVE_CONNECTION)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(service.listFolder(LIVE_CONNECTION, "f")).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(service.readFile(LIVE_CONNECTION, "f")).rejects.toMatchObject({ code: ProviderSandboxErrorCode.LiveAccount })
        await expect(off.grant(CONNECTION)).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
        await expect(off.listFolder(CONNECTION, "f")).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("is the twin the registry answers for a sandbox Drive account; a live account gets the live port and never the sandbox; both register at boot with the catalogue", async () => {
        const { service } = setup()
        const live = mock<DriveLiveReachService>({ provider: "google_drive" })
        const registry = new DriveReachRegistryService()
        const catalogues = new SandboxCatalogueRegistryService()

        new DriveProviderRegistrationService(registry, live, service, catalogues).onModuleInit()

        expect(registry.portFor(CONNECTION)).toBe(service)
        expect(registry.portFor(LIVE_CONNECTION)).toBe(live)
        await registry.portFor(CONNECTION)?.grant(CONNECTION)
        expect(live.grant).not.toHaveBeenCalled()
        expect(catalogues.casesOf("google_drive").map((one) => one.id)).toEqual(GOOGLE_DRIVE_SANDBOX_CASES.map((one) => one.id))
    })

    it("has unique GOOGLE_DRIVE-<n> ids 1..15, exactly one default per operation, three operations, no inbound case", () => {
        const cases = GOOGLE_DRIVE_SANDBOX_CASES
        expect(cases.map((one) => one.id)).toEqual(Array.from({ length: 15 }, (_, index) => `GOOGLE_DRIVE-${String(index + 1)}`))
        expect(Object.values(GOOGLE_DRIVE_CASE)).toEqual(cases.map((one) => one.id))
        expect(cases.filter((one) => one.default === true).map((one) => one.operation).toSorted()).toEqual(["grant", "list", "read"])
        expect(cases.every((one) => one.inbound === undefined && one.label.length > 0)).toBe(true)
        expect(GOOGLE_DRIVE_SANDBOX_CATALOGUE.provider).toBe("google_drive")
    })

    it("has zero network: the sandbox frame only, no Drive client, no token, no http", () => {
        const source = readFileSync(__filename.replace("-reach.service.spec.ts", "-reach.service.ts"), "utf8")
        const catalogue = readFileSync(__filename.replace("-reach.service.spec.ts", ".catalogue.ts"), "utf8")

        expect(GoogleDriveSandboxReachService.length).toBe(1)
        expect(source).not.toContain("http")
        for (const text of [source, catalogue]) {
            expect(text).not.toContain("@modules/integrations")
            expect(text).not.toContain("withToken")
            expect(text).not.toContain("Date.now")
        }
    })
})
