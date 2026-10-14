import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AuthorityService } from "@modules/domain/authority"
import type { Authority } from "@modules/domain/authority"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { WorkspacesService } from "@modules/domain/workspaces"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentBrandService } from "./content-brand.service"
import { SELECT_CONTENT_PUBLIC_SOURCES, SELECT_CONTENT_SETUP } from "./persistence/content-ai.sql"

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
    const entityManager = mockEntityManager({
        query: [
            [SELECT_CONTENT_SETUP, snapshots],
            [SELECT_CONTENT_PUBLIC_SOURCES, [{ title: "Menu", topic: "food", content: "Pho" }]],
        ],
    })
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
            { provide: WorkspacesService, useValue: workspaces },
        ],
    }).compile()
    return moduleRef.get(ContentBrandService)
}

describe("ContentBrandService", () => {
    it("reads the shop, the public setup and drops facts that are not text", async () => {
        const service = await build()

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
    })

    it.each([
        { snapshots: [] },
        { snapshots: [{ snapshot: null }] },
        { snapshots: [{ snapshot: { gates: null, facts: null } }] },
    ])("defaults missing and malformed setup material %#", async ({ snapshots }) => {
        const service = await build(snapshots)
        await expect(service.material("ws-1")).resolves.toMatchObject({
            authority: { brandVoice: "", replyStyle: "", limitsNote: "" },
            setup: { summary: "", facts: [], tone: "", claimsLimits: "", audience: "", channels: "" },
            brainFacts: [],
        })
    })

    it("uses the authority, discards malformed facts and maps customer-visible brain facts", async () => {
        const fact = mock<FactRecord>({ subjectLabel: "Cafe", attributeLabel: "Opening", value: "7am" })
        const service = await build(
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
