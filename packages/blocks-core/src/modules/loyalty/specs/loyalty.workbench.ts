import { specDocumentSchema, type SpecDocument } from "@nivo-lite/agent-sdk/spec"
import data from "./loyalty.workbench.json"

/** The seed spec of the Loyalty workbench: overview, members, rewards, promotions, pending decisions and settings, parsed once. */
export const LOYALTY_WORKBENCH_SPEC: SpecDocument = specDocumentSchema.parse(data)
