import { specDocumentSchema, type SpecDocument } from "@nivo-lite/agent-sdk/spec"
import { viewNodeOf, withAgentDesk, type DeskOfModule } from "../../../../shared/platform/specs/agent-desk"
import data from "./hiring.workbench.json"

/** The desk of the Hiring agent: block 6 lists the candidates and the jobs, each opening the module's own table as a page. */
export const HIRING_DESK: DeskOfModule = {
    dataSets: [
        { set: "candidates", label: { vi: "\u1ee8ng vi\u00ean", en: "Candidates" } },
        { set: "jobs", label: { vi: "V\u1ecb tr\u00ed tuy\u1ec3n", en: "Jobs" } },
    ],
    pages: {
        candidates: viewNodeOf(data, "candidates-table"),
        jobs: viewNodeOf(data, "jobs-table"),
    },
}

/** The seed spec of the Hiring workbench: the agent's desk first, then the candidates with their stage, the jobs, and the detail and forms of the one picked. */
export const HIRING_WORKBENCH_SPEC: SpecDocument = specDocumentSchema.parse(withAgentDesk(data, HIRING_DESK))
