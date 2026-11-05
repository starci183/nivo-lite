import { specDocumentSchema } from "@nivo-lite/agent-sdk/spec"
import type { SpecDocument } from "@nivo-lite/agent-sdk/spec"
import data from "./sales.workbench.json"

/** The seed spec of the Sales workbench: the customers by stage and the orders with the owner's wait, parsed once. */
export const SALES_WORKBENCH_SPEC: SpecDocument = specDocumentSchema.parse(data)
