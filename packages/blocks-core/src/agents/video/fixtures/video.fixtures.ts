import { EMPTY_BRAND, brandViewOf, projectViewOf, renderFilesViewOf, renderViewOf } from "../rules/workbench"
import type { ModuleFixtures } from "../../../shared/modules/module-fixtures"
import { SAMPLE_BRAND, SAMPLE_PROJECTS, SAMPLE_RENDERS } from "./video.data"

const PROJECTS = SAMPLE_PROJECTS.map((item) => projectViewOf(item))
const FIRST = PROJECTS[0] ?? null

/** What the Video workbench draws with no engine: the sample projects, their makings and the brand kit; each action answers ok. */
export const VIDEO_FIXTURES: ModuleFixtures = {
    reads: {
        "blocks-core.video.api.project.list": { ready: { rows: PROJECTS, cursor: null }, empty: { rows: [], cursor: null } },
        "blocks-core.video.api.project.get": { ready: FIRST, empty: null },
        "blocks-core.video.api.render.list": { ready: { rows: SAMPLE_RENDERS.map((item) => renderViewOf(item)), cursor: null }, empty: { rows: [], cursor: null } },
        "blocks-core.video.api.render.get": { ready: SAMPLE_RENDERS[0] === undefined ? null : renderFilesViewOf(SAMPLE_RENDERS[0]), empty: null },
        "blocks-core.video.api.brand-kit.get": { ready: brandViewOf(SAMPLE_BRAND), empty: EMPTY_BRAND },
    },
    actions: {
        "blocks-core.video.project-save": { ok: true, data: { id: FIRST?.id ?? "" } },
        "blocks-core.video.project-archive": { ok: true, data: { id: FIRST?.id ?? "" } },
        "blocks-core.video.brand-kit-save": { ok: true, data: { id: SAMPLE_BRAND.id } },
    },
}
