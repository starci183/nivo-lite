import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { ContentBrandProposalsService } from "@modules/domain/content-brand-proposals"
import type { BrandProposalRecord } from "@modules/domain/content-brand-proposals"
import { ContentSettingsService } from "@modules/domain/content-settings"
import { EventsService } from "@modules/domain/events"
import { SetupMessagesService } from "@modules/domain/module-setup-messages"
import { VideoBrandKitsService } from "@modules/domain/video-brand-kits"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { DOCUMENTS } from "@modules/integrations/documents"
import type { DocumentsPort } from "@modules/integrations/documents"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { BRAND_FILE_MAX_BYTES, BrandKitService, storedKitOf } from "./brand-kit.service"
import { ContentAiErrorCode } from "./errors/content-ai.error"

const VI: Locale = "vi"
const KIT = {
    brandName: "HAKUEN",
    colors: [
        { name: "Gold", hex: "#c2996b" },
        { name: "Brown", hex: "#5a4632" },
    ],
    fonts: ["Cormorant Garamond"],
    tone: "Refined",
    address: "says HAKUEN",
    imagery: ["spa"],
    avoid: ["cheap"],
}
const RECORD: BrandProposalRecord = {
    id: "p-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    setupSessionId: "s-1",
    fileName: "guide.pdf",
    fileSize: 4,
    payload: KIT,
    status: "proposed",
    decidedBy: null,
    createdAt: "2026-10-20T00:00:00.000Z",
}
const PDF_BYTES = new Uint8Array([37, 80, 68, 70])
const PDF = { name: "guide.pdf", contentBase64: Buffer.from(PDF_BYTES).toString("base64") }

const build = async () => {
    const documents = mock<DocumentsPort>()
    const generations = mock<DirectGenerationService>()
    const members = mock<WorkspaceMembersService>()
    const setupMessages = mock<SetupMessagesService>()
    const events = mock<EventsService>()
    const store = mock<ContentBrandProposalsService>()
    const settings = mock<ContentSettingsService>()
    const videoKits = mock<VideoBrandKitsService>()
    const facts = mock<BrainFactsService>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("read")
    members.require.mockResolvedValue(mock<WorkspaceMember>({ displayName: "Mai Linh" }))
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrandKitService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: DOCUMENTS, useValue: documents },
            { provide: DirectGenerationService, useValue: generations },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: SetupMessagesService, useValue: setupMessages },
            { provide: EventsService, useValue: events },
            { provide: ContentBrandProposalsService, useValue: store },
            { provide: ContentSettingsService, useValue: settings },
            { provide: VideoBrandKitsService, useValue: videoKits },
            { provide: BrainFactsService, useValue: facts },
        ],
    }).compile()
    const service = moduleRef.get(BrandKitService)
    return { service, documents, generations, setupMessages, events, store, settings, videoKits, facts }
}

const request = (setupSessionId = "s-1") => ({
    workspaceId: "ws-1",
    installationId: "inst-1",
    setupSessionId,
    file: PDF,
    locale: VI,
})

const ok = (output: string) =>
    ({ ok: true, output, generationId: "g", timings: {}, usage: null }) satisfies {
        ok: true
        output: string
        generationId: string
        timings: Record<string, number>
        usage: null
    }

describe("BrandKitService propose", () => {
    it("reads the PDF, asks the model once, stores the proposal and adds the file and the answer to the setup chat", async () => {
        const { service, documents, generations, setupMessages, store } = await build()
        documents.readFile.mockResolvedValue("guideline text")
        generations.run.mockResolvedValue(ok(JSON.stringify(KIT)))
        store.insert.mockResolvedValue(RECORD)

        const proposal = await service.propose("person-1", request())

        expect(proposal).toMatchObject({ id: "p-1", fileName: "guide.pdf", kit: KIT, status: "proposed" })
        expect(documents.readFile).toHaveBeenCalledWith("guide.pdf", PDF_BYTES, "application/pdf")
        expect(generations.run).toHaveBeenCalledWith(
            expect.objectContaining({ purpose: "brand_kit", module: "content" }),
        )
        expect(store.insert).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            installationId: "inst-1",
            setupSessionId: "s-1",
            fileName: "guide.pdf",
            fileSize: 4,
            payload: JSON.stringify(KIT),
        })
        expect(setupMessages.post).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ role: "user", body: "[PDF] guide.pdf" }),
        )
        expect(setupMessages.post).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ role: "assistant", body: "read" }),
        )
    })

    it("posts nothing in a chat when no setup draft is named", async () => {
        const { service, documents, generations, setupMessages, store } = await build()
        documents.readFile.mockResolvedValue("text")
        generations.run.mockResolvedValue(ok(JSON.stringify(KIT)))
        store.insert.mockResolvedValue(RECORD)

        await service.propose("person-1", { ...request(""), installationId: "" })

        expect(setupMessages.post).not.toHaveBeenCalled()
        expect(store.insert).toHaveBeenCalledWith(
            expect.objectContaining({ installationId: null, setupSessionId: null, fileName: PDF.name }),
        )
    })
})

describe("BrandKitService propose (continued)", () => {
    it("refuses a file that is not a PDF, empty or too large", async () => {
        const { service } = await build()
        const invalid = { code: ContentAiErrorCode.FileInvalid }

        await expect(
            service.propose("p", { ...request(), file: { name: "a.docx", contentBase64: PDF.contentBase64 } }),
        ).rejects.toMatchObject(invalid)
        await expect(
            service.propose("p", { ...request(), file: { name: "a.pdf", contentBase64: "" } }),
        ).rejects.toMatchObject(invalid)
        await expect(
            service.propose("p", {
                ...request(),
                file: { name: "a.pdf", contentBase64: Buffer.alloc(BRAND_FILE_MAX_BYTES + 1).toString("base64") },
            }),
        ).rejects.toMatchObject(invalid)
    })

    it("refuses a PDF the documents integration cannot read", async () => {
        const { service, documents } = await build()
        documents.readFile.mockRejectedValue(new Error("scan"))

        await expect(service.propose("person-1", request())).rejects.toMatchObject({
            code: ContentAiErrorCode.FileInvalid,
        })
    })

    it("is unreadable when the model fails or answers no kit, and fails when nothing was stored", async () => {
        const { service, documents, generations, store } = await build()
        documents.readFile.mockResolvedValue("text")
        generations.run.mockResolvedValueOnce({ ok: false, reason: "error", message: "busy" })
        generations.run.mockResolvedValueOnce(ok("{}"))
        generations.run.mockResolvedValueOnce(ok(JSON.stringify(KIT)))
        store.insert.mockResolvedValue(null)

        const unreadable = { code: ContentAiErrorCode.BrandUnreadable }
        await expect(service.propose("person-1", request())).rejects.toMatchObject(unreadable)
        await expect(service.propose("person-1", request())).rejects.toMatchObject(unreadable)
        await expect(service.propose("person-1", request())).rejects.toMatchObject({
            code: ContentAiErrorCode.ProposalNotFound,
        })
    })
})

describe("BrandKitService proposals and decide", () => {
    it("lists the instance's proposals, an unreadable payload as an empty kit", async () => {
        const { service, store } = await build()
        store.list.mockResolvedValue([RECORD, { ...RECORD, id: "p-2", payload: "x" }])

        const listed = await service.proposals("person-1", "ws-1", "inst-1")

        expect(listed.map((entry) => entry.kit.brandName)).toEqual(["HAKUEN", ""])
    })

    it("confirms the kit into the content settings and the video brand kit and records the event", async () => {
        const { service, store, settings, videoKits, events, facts } = await build()
        store.find.mockResolvedValue(RECORD)
        store.close.mockResolvedValue({ ...RECORD, status: "applied", decidedBy: "Mai Linh" })

        await expect(service.decide("person-1", "ws-1", "p-1", { decision: "confirm" })).resolves.toMatchObject({
            status: "applied",
        })
        expect(settings.saveGuidelineBrand).toHaveBeenCalledWith("ws-1", {
            colors: KIT.colors,
            fonts: KIT.fonts,
            tone: "Refined",
            imagery: ["spa"],
            source: "guide.pdf",
            voice: "Refined says HAKUEN",
            avoid: "cheap",
        })
        expect(videoKits.saveGuidelineColors).toHaveBeenCalledWith("ws-1", "person-1", {
            primary: "#c2996b",
            secondary: "#5a4632",
            shopName: "HAKUEN",
        })
        expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ kind: "content.brand_applied" }))
        expect(facts.propose).toHaveBeenCalledTimes(5)
        expect(facts.propose).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({
                subjectLabel: "HAKUEN",
                attributeLabel: "Brand colors",
                value: "Gold #c2996b, Brown #5a4632",
                sourceKind: "owner",
                evidence: [{ kind: "document", ref: "brand_proposal:p-1", label: "guide.pdf" }],
            }),
        )
    })
})

describe("BrandKitService proposals and decide (continued)", () => {
    it("uses a single color twice and writes no video colors for a tone-only kit", async () => {
        const { service, store, videoKits, facts } = await build()
        store.find.mockResolvedValue(RECORD)
        store.close.mockResolvedValue({ ...RECORD, status: "applied" })

        await service.decide("person-1", "ws-1", "p-1", {
            decision: "confirm",
            kit: { ...KIT, colors: [{ name: "Gold", hex: "#C2996B" }] },
        })
        await service.decide("person-1", "ws-1", "p-1", {
            decision: "confirm",
            kit: { ...KIT, brandName: "", colors: [], fonts: [], imagery: [], avoid: [] },
        })
        expect(facts.propose).toHaveBeenLastCalledWith(
            "ws-1",
            expect.objectContaining({ subjectLabel: "Brand", attributeLabel: "Brand tone" }),
        )

        expect(videoKits.saveGuidelineColors).toHaveBeenCalledTimes(1)
        expect(videoKits.saveGuidelineColors).toHaveBeenCalledWith("ws-1", "person-1", {
            primary: "#c2996b",
            secondary: "#c2996b",
            shopName: "HAKUEN",
        })
    })

    it("rejects without writing settings or an event", async () => {
        const { service, store, settings, events } = await build()
        store.find.mockResolvedValue(RECORD)
        store.close.mockResolvedValue({ ...RECORD, status: "rejected" })

        await expect(service.decide("person-1", "ws-1", "p-1", { decision: "reject" })).resolves.toMatchObject({
            status: "rejected",
        })
        expect(settings.saveGuidelineBrand).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })

    it("refuses an unknown, an invalid edit and an already decided proposal", async () => {
        const { service, store } = await build()
        store.find.mockResolvedValueOnce(null)
        await expect(service.decide("p", "ws-1", "p-1", { decision: "confirm" })).rejects.toMatchObject({
            code: ContentAiErrorCode.ProposalNotFound,
        })
        store.find.mockResolvedValue(RECORD)
        await expect(
            service.decide("p", "ws-1", "p-1", { decision: "confirm", kit: { ...KIT, colors: [], tone: "" } }),
        ).rejects.toMatchObject({ code: ContentAiErrorCode.KitInvalid })
        store.close.mockResolvedValue(null)
        await expect(service.decide("p", "ws-1", "p-1", { decision: "confirm" })).rejects.toMatchObject({
            code: ContentAiErrorCode.ProposalDecided,
        })
    })
})

describe("BrandKitService brandOf and storedKitOf", () => {
    it("answers the stored kit with the kit name and the logo", async () => {
        const { service, settings, videoKits } = await build()
        settings.guidelineBrandOf.mockResolvedValue({
            colors: [{ name: "Gold", hex: "#c2996b" }],
            fonts: ["F"],
            tone: "Warm",
            imagery: ["spa"],
            avoid: "cheap\n\n",
        })
        videoKits.identityOf.mockResolvedValue({ logoPath: "ws-1/logo.png", shopName: "HAKUEN" })

        await expect(service.brandOf("ws-1")).resolves.toEqual({
            kit: {
                brandName: "HAKUEN",
                colors: [{ name: "Gold", hex: "#c2996b" }],
                fonts: ["F"],
                tone: "Warm",
                address: "",
                imagery: ["spa"],
                avoid: ["cheap"],
            },
            logoPath: "ws-1/logo.png",
        })
    })

    it("answers no kit without settings or with an empty one", () => {
        expect(storedKitOf(null, "H")).toBeNull()
        expect(storedKitOf({ colors: "x", fonts: [], tone: "", imagery: [], avoid: "" }, "H")).toBeNull()
    })
})
