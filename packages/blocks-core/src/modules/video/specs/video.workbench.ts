import { specDocumentSchema, type SpecDocument } from "@nivo-lite/agent-sdk/spec"
import { viewNodeOf, withAgentDesk, type DeskOfModule } from "../../platform/specs/agent-desk"
import data from "./video.workbench.json"

/** The desk of the Video agent: block 6 lists the projects, opening the module's own project list as a page. */
export const VIDEO_DESK: DeskOfModule = {
    dataSets: [{ set: "projects", label: { vi: "D\u1ef1 \u00e1n video", en: "Video projects" } }],
    pages: { projects: viewNodeOf(data, "projects-pane") },
}

/** The seed spec of the Video workbench: the agent's desk first, then the projects with their script and makings, a new project, and the brand kit, parsed once. */
export const VIDEO_WORKBENCH_SPEC: SpecDocument = specDocumentSchema.parse(withAgentDesk(data, VIDEO_DESK))
