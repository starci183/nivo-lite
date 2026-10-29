import type { RenderDone } from "@modules/domain/video-renders"

/** A render the workbench queues, with its spec as JSON text. */
export const NEW_RENDER = { workspaceId: "workspace-1", spec: '{"version":1}', createdBy: "person-1" }

/** What the renderer reports for a render that finished. */
export const DONE_RENDER: RenderDone = {
    outputPath: "w/r/video.mp4",
    posterPath: "w/r/poster.jpg",
    durationMs: 12000,
    sizeBytes: 345,
    meta: { fps: 30 },
}

/** Three completed renders as the media query selects them: titled by project, by brand, and by nothing. */
export const COMPLETED_MEDIA_ROWS = [
    {
        id: "render-1",
        brand_name: "Brand",
        output_path: "workspace-1/render-1/video.mp4",
        duration_ms: 12000,
        created_at: new Date("2026-10-13T09:00:00.000Z"),
    },
    {
        id: "render-2",
        brand_name: "Bakery",
        output_path: "workspace-1/render-2/video.mp4",
        duration_ms: null,
        created_at: "2026-10-14T09:00:00.000Z",
    },
    {
        id: "render-3",
        brand_name: null,
        output_path: "workspace-1/render-3/video.mp4",
        duration_ms: null,
        created_at: "2026-10-15T09:00:00.000Z",
    },
]

/** The media `COMPLETED_MEDIA_ROWS` become when only the first render has a project title (`Offer`). */
export const COMPLETED_MEDIA = [
    {
        id: "render-1",
        title: "Offer",
        outputPath: "workspace-1/render-1/video.mp4",
        durationMs: 12000,
        createdAt: "2026-10-13T09:00:00.000Z",
    },
    {
        id: "render-2",
        title: "Bakery",
        outputPath: "workspace-1/render-2/video.mp4",
        durationMs: null,
        createdAt: "2026-10-14T09:00:00.000Z",
    },
    {
        id: "render-3",
        title: "",
        outputPath: "workspace-1/render-3/video.mp4",
        durationMs: null,
        createdAt: "2026-10-15T09:00:00.000Z",
    },
]
