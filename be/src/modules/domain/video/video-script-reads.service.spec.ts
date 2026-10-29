import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import type { ContextVersionRecord } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { NivoKnowledgeService } from "@modules/domain/nivo-knowledge"
import { VideoBrandKitsService } from "@modules/domain/video-brand-kits"
import { VideoProjectsService } from "@modules/domain/video-projects"
import type { ScriptProjectRow } from "@modules/domain/video-projects"
import { VideoRendersService } from "@modules/domain/video-renders"
import { WorkspacesService } from "@modules/domain/workspaces"
import { VideoScriptReadsService } from "./video-script-reads.service"

const WS = "workspace-1"

const rowOf = builder<ScriptProjectRow>({
    id: "project-1",
    title: "Spring offer",
    goal: "offer",
    aspect: "9:16",
    target_seconds: 30,
    status: "draft",
    inputs: {},
    script_meta: {},
    updated_at: "2026-10-13T09:00:00.000Z",
    render_id: "render-1",
})

const installationOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: WS,
    moduleKey: "video",
    name: "AI Editor",
    isMulti: false,
    agentId: "agent-1",
    status: "live",
    operatingMode: "assist",
    liveEnabled: true,
    activeContextVersionId: "version-1",
    settings: {},
    createdAt: "2026-10-01T00:00:00.000Z",
})

const versionOf = builder<ContextVersionRecord>({
    id: "version-1",
    installationId: "inst-1",
    version: 2,
    snapshot: { summary: "Sell bread", facts: [], gates: {} },
    appliedBy: "Lan",
    appliedAt: "2026-10-12T10:00:00.000Z",
})

const build = async () => {
    const projects = mock<VideoProjectsService>()
    const renders = mock<VideoRendersService>()
    const brandKits = mock<VideoBrandKitsService>()
    const workspaces = mock<WorkspacesService>()
    const knowledge = mock<KnowledgeSourcesReadService>()
    const installations = mock<InstallationRecordsService>()
    const versions = mock<ContextVersionsService>()
    const nivo = mock<NivoKnowledgeService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoScriptReadsService,
            { provide: VideoProjectsService, useValue: projects },
            { provide: VideoRendersService, useValue: renders },
            { provide: VideoBrandKitsService, useValue: brandKits },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: KnowledgeSourcesReadService, useValue: knowledge },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ContextVersionsService, useValue: versions },
            { provide: NivoKnowledgeService, useValue: nivo },
        ],
    }).compile()
    return {
        reads: moduleRef.get(VideoScriptReadsService),
        projects,
        renders,
        brandKits,
        workspaces,
        knowledge,
        installations,
        versions,
        nivo,
    }
}

describe("VideoScriptReadsService > projectOf", () => {
    it("adds the render status, the workspace name and the brand name to the project", async () => {
        const { reads, projects, renders, workspaces, brandKits } = await build()
        const tx = mockEntityManager()
        projects.readForScript.mockResolvedValue(rowOf())
        renders.stateOf.mockResolvedValue("rendering")
        workspaces.nameOf.mockResolvedValue("Bakery")
        brandKits.kitOf.mockResolvedValue({
            shopName: "Bakery Shop",
            primaryColor: "#111111",
            secondaryColor: "#222222",
            logoPath: null,
            musicTrack: null,
            voice: "vi-VN-NamMinhNeural",
        })

        await expect(reads.projectOf(tx, WS, "project-1", true)).resolves.toEqual({
            id: "project-1",
            title: "Spring offer",
            goal: "offer",
            aspect: "9:16",
            target_seconds: 30,
            status: "draft",
            inputs: {},
            script_meta: {},
            updated_at: "2026-10-13T09:00:00.000Z",
            render_status: "rendering",
            workspace_name: "Bakery",
            shop_name: "Bakery Shop",
        })
        expect(projects.readForScript).toHaveBeenCalledWith(tx, WS, "project-1", true)
        expect(renders.stateOf).toHaveBeenCalledWith("render-1")
    })

    it("shows no render status and no brand name for a project without a render or a kit", async () => {
        const { reads, projects, renders, workspaces, brandKits } = await build()
        projects.readForScript.mockResolvedValue(rowOf({ render_id: null }))
        workspaces.nameOf.mockResolvedValue("Bakery")
        brandKits.kitOf.mockResolvedValue(null)

        await expect(reads.projectOf(mockEntityManager(), WS, "project-1", false)).resolves.toMatchObject({
            render_status: null,
            workspace_name: "Bakery",
            shop_name: null,
        })
        expect(renders.stateOf).not.toHaveBeenCalled()
    })

    it("answers nothing for a project the workspace does not have", async () => {
        const { reads, projects, workspaces } = await build()
        projects.readForScript.mockResolvedValue(undefined)

        await expect(reads.projectOf(mockEntityManager(), WS, "missing", false)).resolves.toBeUndefined()
        expect(workspaces.nameOf).not.toHaveBeenCalled()
    })
})

describe("VideoScriptReadsService > sourcesOf", () => {
    it("reads the chosen public video sources, at most twelve", async () => {
        const { reads, knowledge } = await build()
        const sources = [{ title: "Menu", topic: null, content: "Bread 20k" }]
        knowledge.publicTexts.mockResolvedValue(sources)

        await expect(reads.sourcesOf(WS, ["s1"])).resolves.toBe(sources)
        expect(knowledge.publicTexts).toHaveBeenCalledWith(WS, "video", ["s1"], 12)
    })
})

describe("VideoScriptReadsService > setupOf", () => {
    it("answers the snapshot of the active version of the oldest video installation", async () => {
        const { reads, installations, versions } = await build()
        installations.firstOfModule.mockResolvedValue(installationOf())
        versions.find.mockResolvedValue(versionOf())

        await expect(reads.setupOf(WS)).resolves.toEqual([{ snapshot: versionOf().snapshot }])
        expect(installations.firstOfModule).toHaveBeenCalledWith(WS, "video")
        expect(versions.find).toHaveBeenCalledWith("version-1")
    })

    it.each([
        ["no video installation", null, null],
        ["no applied version", installationOf({ activeContextVersionId: null }), null],
        ["a version that is gone", installationOf(), null],
        ["a version of another installation", installationOf(), versionOf({ installationId: "inst-9" })],
    ])("answers nothing for %s", async (_label, installation, version) => {
        const { reads, installations, versions } = await build()
        installations.firstOfModule.mockResolvedValue(installation)
        versions.find.mockResolvedValue(version)

        await expect(reads.setupOf(WS)).resolves.toEqual([])
    })
})

describe("VideoScriptReadsService > baseRules", () => {
    it("reads the authority, escalation and tone rules of video and the core agent, at most twenty", async () => {
        const { reads, nivo } = await build()
        const rules = [{ title: "Honesty", body: "Never invent prices" }]
        nivo.rulesOf.mockResolvedValue(rules)

        await expect(reads.baseRules()).resolves.toBe(rules)
        expect(nivo.rulesOf).toHaveBeenCalledWith(["video", "core"], ["authority", "escalation", "tone"], 20)
    })
})
