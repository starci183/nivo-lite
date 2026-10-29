import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AuthorityService } from "@modules/domain/authority"
import type { Authority } from "@modules/domain/authority"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import type { ContextVersionRecord, VersionSnapshot } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { WorkspacesService } from "@modules/domain/workspaces"
import { ContentBrandService } from "./content-brand.service"

const gate = (evidence: string) => ({ status: "confirmed" as const, evidence })

const SNAPSHOT: VersionSnapshot = {
    summary: " Cafe ",
    facts: [{ key: "hours", text: "opens at 7" }],
    gates: {
        tone: gate("warm"),
        claims_limits: gate("no medical"),
        audience: gate("office"),
        channels: gate("zalo"),
    },
}

const build = async (
    snapshot: VersionSnapshot | null = SNAPSHOT,
    profile: Authority | null = null,
    records: ReadonlyArray<FactRecord> = [],
) => {
    const sources = mock<KnowledgeSourcesReadService>()
    sources.allPublicTexts.mockResolvedValue([{ title: "Menu", topic: "food", content: "Pho" }])
    const installations = mock<InstallationRecordsService>()
    installations.firstOfModule.mockResolvedValue(
        snapshot === null ? null : mock<InstallationRecord>({ activeContextVersionId: "v-1" }),
    )
    const versions = mock<ContextVersionsService>()
    versions.find.mockResolvedValue(snapshot === null ? null : mock<ContextVersionRecord>({ snapshot }))
    const authority = mock<AuthorityService>()
    authority.load.mockResolvedValue(profile)
    const facts = mock<BrainFactsService>()
    facts.forView.mockResolvedValue(records)
    const workspaces = mock<WorkspacesService>()
    workspaces.nameOf.mockResolvedValue("Lan")
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentBrandService,
            { provide: AuthorityService, useValue: authority },
            { provide: BrainFactsService, useValue: facts },
            { provide: KnowledgeSourcesReadService, useValue: sources },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ContextVersionsService, useValue: versions },
            { provide: WorkspacesService, useValue: workspaces },
        ],
    }).compile()
    return { service: moduleRef.get(ContentBrandService), installations, versions, sources }
}

describe("ContentBrandService", () => {
    it("reads the shop, the public setup and drops facts that are not text", async () => {
        const { service, installations, versions, sources } = await build()

        await expect(service.material("ws-1")).resolves.toEqual({
            shop: "Lan",
            authority: { brandVoice: "", replyStyle: "", limitsNote: "" },
            setup: {
                summary: "Cafe",
                facts: ["opens at 7"],
                tone: "warm",
                claimsLimits: "no medical",
                audience: "office",
                channels: "zalo",
            },
            sources: [{ title: "Menu", topic: "food", content: "Pho" }],
            brainFacts: [],
        })
        expect(installations.firstOfModule).toHaveBeenCalledWith("ws-1", "content")
        expect(versions.find).toHaveBeenCalledWith("v-1")
        expect(sources.allPublicTexts).toHaveBeenCalledWith("ws-1", "content", 40)
    })

    it("defaults the setup when the module has no applied version", async () => {
        const { service } = await build(null)
        await expect(service.material("ws-1")).resolves.toMatchObject({
            authority: { brandVoice: "", replyStyle: "", limitsNote: "" },
            setup: { summary: "", facts: [], tone: "", claimsLimits: "", audience: "", channels: "" },
            brainFacts: [],
        })
    })

    it("defaults the setup when the installation names no version or the version is gone", async () => {
        const { service, installations, versions } = await build()
        installations.firstOfModule.mockResolvedValueOnce(mock<InstallationRecord>({ activeContextVersionId: null }))
        await expect(service.material("ws-1")).resolves.toMatchObject({ setup: { summary: "" } })
        versions.find.mockResolvedValueOnce(null)
        await expect(service.material("ws-1")).resolves.toMatchObject({ setup: { summary: "" } })
    })

    it("uses the authority, discards malformed facts and maps customer-visible brain facts", async () => {
        const fact = mock<FactRecord>({ subjectLabel: "Cafe", attributeLabel: "Opening", value: "7am" })
        const { service } = await build(
            {
                summary: " Ready ",
                facts: [{ key: "pub", text: "Public fact" }],
                gates: { audience: gate(" Regulars ") },
            },
            { policies: "", brand_voice: "warm", reply_style: "brief", limits_note: "No cures" },
            [fact],
        )
        await expect(service.material("ws-1")).resolves.toEqual({
            shop: "Lan",
            authority: { brandVoice: "warm", replyStyle: "brief", limitsNote: "No cures" },
            setup: {
                summary: "Ready",
                facts: ["Public fact"],
                tone: "",
                claimsLimits: "",
                audience: "Regulars",
                channels: "",
            },
            sources: [{ title: "Menu", topic: "food", content: "Pho" }],
            brainFacts: [{ subject: "Cafe", attribute: "Opening", value: "7am" }],
        })
    })
})
