import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    defineTemplateGraph,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { bilingualOf } from "../../../messages/catalog"
import { contentReportNode } from "../../../nodes/content/report.node"

/** The key of the weekly report. */
export const CONTENT_REPORT_GRAPH_KEY = "content.report"

/** What the template catalogue shows of `content.report`. */
const CATALOGUE: TemplateCatalogue = {
    name: bilingualOf("contentReportTemplateName"),
    summary: bilingualOf("contentReportTemplateSummary"),
    version: 2,
    publishedAt: "2026-11-14T04:15:00.000Z",
    notes: bilingualOf("contentReportTemplateNotes"),
    seedActive: true,
}

/**
 * `content.report` version 1: called by the morning run of `content.plan` (an agent's graphs share no clock
 * verb, and no weekly clock preset exists); on the shop's Monday the report step tells the team how the last whole week's posts stand,
 * on the other days it posts nothing.
 */
export const contentReportGraph: TemplateGraph = defineTemplateGraph({
    key: CONTENT_REPORT_GRAPH_KEY,
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: z.object({}) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "report",
    nodes: {
        report: node(contentReportNode, { next: "reported" }),
        reported: outcome({ name: "reported", output: { posted: ref("steps.report.output.posted") } }),
    },
})
