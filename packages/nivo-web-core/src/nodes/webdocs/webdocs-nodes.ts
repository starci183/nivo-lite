import type { TemplateNode } from "@nivo-lite/agent-sdk/template"
import { webdocsDraftPostNode } from "./draft-post.node"
import { webdocsDraftNode } from "./draft.node"
import { webdocsReadNode } from "./read.node"

/** The steps of the Paperwork agent: read the relevant documents, write the draft, hand a workflow's draft to the team. */
export const webdocsNodes: ReadonlyArray<TemplateNode> = [webdocsReadNode, webdocsDraftNode, webdocsDraftPostNode]
