import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { VIDEO_PROJECT_STATUSES } from "../entities/project.entity"
import {
    type BrandView,
    type ProjectView,
    type RenderFilesView,
    type RenderView,
    brandViewOf,
    projectViewOf,
    renderFilesViewOf,
    renderViewOf,
} from "../rules/workbench"
import { PROJECTS_PAGE, RENDERS_SHOWN, VIDEO_VIEW } from "../constants"
import { BRAND, PROJECTS, RENDERS } from "../ports"

/** The longest cursor a page of projects carries. */
const CURSOR_MAX = 2048

/** The filter of the projects list: every project but the archived ones, or one status. */
const PROJECT_FILTERS = ["all", ...VIDEO_PROJECT_STATUSES] as const

/** The fields of a project the list and the detail show. */
const PROJECT_FIELDS: ReadonlyArray<keyof ProjectView> = [
    "id",
    "title",
    "goal",
    "aspect",
    "targetSeconds",
    "brief",
    "status",
    "scenes",
    "sceneCount",
    "lastError",
    "publishedAt",
    "updatedAt",
]

/** The fields of a render the history shows. */
const RENDER_FIELDS: ReadonlyArray<keyof RenderView> = ["id", "state", "clipCount", "hasVoice", "error", "createdAt"]

/** The fields of one render the file preview shows. */
const RENDER_FILES_FIELDS: ReadonlyArray<keyof RenderFilesView> = ["id", "output", "clips", "voice"]

/** The fields of the brand kit the form shows. */
const BRAND_FIELDS: ReadonlyArray<keyof BrandView> = ["id", "shopName", "primaryColor", "secondaryColor", "voiceId"]

/** `blocks-core.video.api.project.list`: the projects of the workspace, newest first, narrowed by status (all but the archived ones by default). */
export const projectsRead: ReadDefinition = defineRead({
    id: "blocks-core.video.api.project.list",
    dataKind: "video-project",
    shape: "list",
    fields: PROJECT_FIELDS,
    paths: { rows: "list" },
    variables: z.object({
        status: z.enum(PROJECT_FILTERS).default("all"),
        cursor: z.string().min(1).max(CURSOR_MAX).optional(),
    }),
    permission: VIDEO_VIEW,
    ports: { projects: PROJECTS },
    run: async ({ projects }, variables): Promise<{ readonly rows: ReadonlyArray<ProjectView>; readonly cursor: string | null }> => {
        const where = variables.status === "all" ? q.ne("status", "archived") : q.eq("status", variables.status)
        const page = await projects.list({
            select: ["title", "goal", "aspect", "targetSeconds", "brief", "status", "script", "lastError", "publishedAt"],
            where,
            order:
                variables.status === "all"
                    ? [
                          ["createdAt", "desc"],
                          ["id", "desc"],
                      ]
                    : [
                          ["status", "asc"],
                          ["createdAt", "desc"],
                          ["id", "desc"],
                      ],
            page: { size: PROJECTS_PAGE, ...(variables.cursor === undefined ? {} : { after: variables.cursor }) },
        })
        return { rows: page.rows.map((listed) => projectViewOf(listed.row)), cursor: page.next }
    },
})

/** `blocks-core.video.api.project.get`: one project with its script, which the detail and the edit form start from; null when there is none. */
export const projectRead: ReadDefinition = defineRead({
    id: "blocks-core.video.api.project.get",
    dataKind: "video-project",
    shape: "record",
    fields: PROJECT_FIELDS,
    paths: {},
    variables: z.object({ id: z.string().min(1).max(MAX_ID) }),
    permission: VIDEO_VIEW,
    ports: { projects: PROJECTS },
    run: async ({ projects }, { id }): Promise<ProjectView | null> => {
        const found = await projects.get(id)
        return found === null ? null : projectViewOf(found)
    },
})

/** `blocks-core.video.api.render.list`: the makings of one project's video, newest first. */
export const rendersRead: ReadDefinition = defineRead({
    id: "blocks-core.video.api.render.list",
    dataKind: "video-render",
    shape: "list",
    fields: RENDER_FIELDS,
    paths: { rows: "list" },
    variables: z.object({ projectId: z.string().min(1).max(MAX_ID) }),
    permission: VIDEO_VIEW,
    ports: { renders: RENDERS },
    run: async ({ renders }, { projectId }): Promise<{ readonly rows: ReadonlyArray<RenderView>; readonly cursor: null }> => {
        const page = await renders.list({
            select: ["state", "clips", "voice", "error"],
            where: q.eq("projectId", projectId),
            order: [
                ["projectId", "asc"],
                ["createdAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: RENDERS_SHOWN },
        })
        return { rows: page.rows.map((listed) => renderViewOf(listed.row)), cursor: null }
    },
})

/** `blocks-core.video.api.render.get`: the composed video, the clips and the narration of one making, which the file previews start from; null when there is none. */
export const renderRead: ReadDefinition = defineRead({
    id: "blocks-core.video.api.render.get",
    dataKind: "video-render",
    shape: "record",
    fields: RENDER_FILES_FIELDS,
    paths: {},
    variables: z.object({ id: z.string().min(1).max(MAX_ID) }),
    permission: VIDEO_VIEW,
    ports: { renders: RENDERS },
    run: async ({ renders }, { id }): Promise<RenderFilesView | null> => {
        const found = await renders.get(id)
        return found === null ? null : renderFilesViewOf(found)
    },
})

/** `blocks-core.video.api.brand-kit.get`: the brand kit of the workspace, which the brand form starts from; the empty kit before one is saved. */
export const brandRead: ReadDefinition = defineRead({
    id: "blocks-core.video.api.brand-kit.get",
    dataKind: "video-brand-kit",
    shape: "record",
    fields: BRAND_FIELDS,
    paths: {},
    variables: z.object({}),
    permission: VIDEO_VIEW,
    ports: { brand: BRAND },
    run: async ({ brand }): Promise<BrandView> => {
        const page = await brand.list({
            select: ["shopName", "primaryColor", "secondaryColor", "voiceId"],
            where: q.eq("key", "video"),
            order: [
                ["key", "asc"],
                ["id", "asc"],
            ],
            page: { size: 1 },
        })
        return brandViewOf(page.rows[0]?.row ?? null)
    },
})
