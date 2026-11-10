import { brainTabHref, knowledgeSourceHref } from "@/modules/routes"
import type { GuideDoc } from "@/modules/guide"
import type {
    BrainQuery,
    ConnectionsQuery,
    InboxLeadsQuery,
    KnowledgeSourcesQuery,
    ModuleInstallationsQuery,
} from "@/modules/api"

/** What the drawer read, each part undefined until its read answers. */
interface GuideReads {
    readonly installations: ModuleInstallationsQuery["moduleInstallations"] | undefined
    readonly connections: ConnectionsQuery["connections"] | undefined
    readonly brain: BrainQuery["brain"] | undefined
    readonly documents: KnowledgeSourcesQuery["knowledgeSources"] | undefined
    readonly leads: InboxLeadsQuery["inboxLeads"] | undefined
}

/** The most facts and documents the index holds. */
const BULK_LIMIT = 200

/** The pages that open one connection; any other provider opens the generic connection page. */
const CONNECTION_PAGES: Readonly<Record<string, string>> = { sepay: "sepay", telegram: "telegram", zalo_oa: "zalo" }

/** The page of one connection. */
export const connectionHref = (provider: string, id: string): string =>
    `/connections/${CONNECTION_PAGES[provider] ?? "open"}/${encodeURIComponent(id)}`

/** The workspace's own things as searchable documents. Their words are the workspace's data, not catalog words. */
export const docsOfData = (reads: GuideReads): ReadonlyArray<GuideDoc> => [
    ...(reads.installations ?? []).map(
        (one): GuideDoc => ({
            id: `agent-${one.id}`,
            group: "found",
            kind: "agent",
            title: one.agentName,
            hint: one.name,
            keywords: [one.agentHandle, one.moduleKey],
            href: `/agents/${one.moduleKey}/${one.id}`,
        }),
    ),
    ...(reads.connections ?? []).map(
        (one): GuideDoc => ({
            id: `connection-${one.id}`,
            group: "found",
            kind: "connection",
            title: one.name,
            hint: one.provider,
            keywords: [one.provider],
            href: connectionHref(one.provider, one.id),
        }),
    ),
    ...(reads.leads?.leads ?? []).map(
        (one): GuideDoc => ({
            id: `lead-${one.id}`,
            group: "found",
            kind: one.stage === "ordered" || one.stage === "paid" ? "order" : "lead",
            title: one.name,
            hint: one.summary,
            keywords: [one.channel],
            href: "/inbox",
        }),
    ),
    ...(reads.documents ?? []).slice(0, BULK_LIMIT).map(
        (one): GuideDoc => ({
            id: `document-${one.id}`,
            group: "found",
            kind: "document",
            title: one.title,
            hint: one.topic ?? "",
            keywords: one.tags,
            href: knowledgeSourceHref(one.id),
        }),
    ),
    ...(reads.brain?.facts ?? []).slice(0, BULK_LIMIT).map(
        (one): GuideDoc => ({
            id: `fact-${one.id}`,
            group: "found",
            kind: "fact",
            title: `${one.subjectLabel} - ${one.attributeLabel}`,
            hint: one.value,
            keywords: [],
            href: brainTabHref("facts"),
        }),
    ),
]
