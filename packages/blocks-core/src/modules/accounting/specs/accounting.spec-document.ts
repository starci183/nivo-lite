import { specDocumentSchema, type StoredSpec } from "@nivo-lite/agent-sdk/spec"
import raw from "./accounting.workbench.json"

/** The seed spec of the Accounting workbench: figures above a searchable, filterable list of book entries and the chosen entry's detail. */
export const accountingSpecDocument: StoredSpec = specDocumentSchema.parse(raw)
