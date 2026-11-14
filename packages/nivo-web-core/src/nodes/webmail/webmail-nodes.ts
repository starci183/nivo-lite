import type { TemplateNode } from "@nivo-lite/agent-sdk/template"
import { webmailReadNode } from "./read.node"
import { webmailSortNode } from "./sort.node"
import { webmailSortedReportNode } from "./sorted-report.node"

/**
 * The steps of the Mailbox agent: fetch the new mail (a plain tool call), sort each mail, tell the team and hand the sorted mail
 * on. `webmail.classify` and `webmail.report` are deleted with the old versions that used them (ADDENDUM 2).
 */
export const webmailNodes: ReadonlyArray<TemplateNode> = [webmailReadNode, webmailSortNode, webmailSortedReportNode]
