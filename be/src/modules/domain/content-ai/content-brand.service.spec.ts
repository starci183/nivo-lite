import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AuthorityService } from "@modules/domain/authority"
import type { Authority } from "@modules/domain/authority"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { ModuleInstallationEntity } from "@modules/domain/module-installations"
import { WorkspacesService } from "@modules/domain/workspaces"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { ContentBrandService } from "./content-brand.service"

const SNAPSHOT = {
    summary: " Cafe ",
    facts: [{ text: "opens at 7" }, { text: 1 }],
    gates: {
        tone: { evidence: "warm" },
        claims_limits: { evidence: "no medical" },
        audience: { evidence: "office" },
        channels: { evidence: "zalo" },
    },
}

const build = async (
    snapshots: ReadonlyArray<{ snapshot: unknown }> = [{ snapshot: SNAPSHOT }],
    profile: Authority | null = null,
    records: ReadonlyArray<FactRecord> = [],
) => {
    const entityManager = mockEntityManager()
    const sources = mock<KnowledgeSourcesReadService>()
    sources.allPublicTexts.mockResolvedValue([{ title: "Menu", topic: "food", content: "Pho" }])
    const [setup] = queueQueryBuilders(entityManager, [{ getRawOne: snapshots[0] }])
    const authority = mock<AuthorityService>()
    authority.load.mockResolvedValue(profile)
    const facts = mock<BrainFactsService>()
    facts.forView.mockResolvedValue(records)
    const workspaces = mock<WorkspacesService>()
    workspaces.nameOf.mockResolvedValue("Lan")
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentBrandService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AuthorityService, useValue: authority },
            { provide: BrainFactsService, useValue: facts },
            { provide: KnowledgeSourcesReadService, useValue: sources },
            { provide: WorkspacesService, useValue: workspaces },
        ],
    }).compile()
    return { service: moduleRef.get(ContentBrandService), entityManager, setup, sources }
}

describe("ContentBrandService", () => {
    it("reads the shop, the public setup and drops facts that are not text", async () => {
        const { service, entityManager, setup, sources } = await build()

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
        expect(entityManager.createQueryBuilder).toHaveBeenCalledWith(ModuleInstallationEntity, "i")
        expect(setup?.callsOf("where")).toEqual([
            ["i.workspace_id = :workspaceId AND i.module_key = 'content'", { workspaceId: "ws-1" }],
        ])
        expect(setup?.callsOf("limit")).toEqual([[1]])
        expect(sources.allPublicTexts).toHaveBeenCalledWith("ws-1", "content", 40)
    })

    it.each([
        { snapshots: [] },
        { snapshots: [{ snapshot: null }] },
        { snapshots: [{ snapshot: { gates: null, facts: null } }] },
    ])("defaults missing and malformed setup material %#", async ({ snapshots }) => {
        const { service } = await build(snapshots)
        await expect(service.material("ws-1")).resolves.toMatchObject({
            authority: { brandVoice: "", replyStyle: "", limitsNote: "" },
            setup: { summary: "", facts: [], tone: "", claimsLimits: "", audience: "", channels: "" },
            brainFacts: [],
        })
    })

    it("uses the authority, discards malformed facts and maps customer-visible brain facts", async () => {
        const fact = mock<FactRecord>({ subjectLabel: "Cafe", attributeLabel: "Opening", value: "7am" })
        const { service } = await build(
            [
                {
                    snapshot: {
                        summary: " Ready ",
                        facts: [null, 5, { text: "Public fact" }],
                        gates: { tone: false, audience: { evidence: " Regulars " } },
                    },
                },
            ],
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
