import { withAgentDesk } from "@nivo-lite/blocks-core"
import { type SpecDocument, specDocumentSchema } from "@nivo-lite/agent-sdk/spec"
import { WEBMAIL_DESK } from "../../../vocabulary/crm-pages"
import data from "./webmail.workbench.json"

/** The seed workbench spec of the module, parsed once: the agent's desk first, then its own tab of runs running or waiting for a person, then the desk's data pages. */
export const WEBMAIL_WORKBENCH_SPEC: SpecDocument = specDocumentSchema.parse(withAgentDesk(data, WEBMAIL_DESK))
