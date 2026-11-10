import type { useFormatter, useTranslations } from "next-intl"
import type { IconName } from "@/components/leaves/Icon"
import type { AgentKnowledgeData } from "@/hooks/agentKnowledge"
import { brainTabHref, knowledgeSourceHref, workspaceHref } from "@/modules/routes"

/** The translator of the knowledge tab. */
export type Translate = ReturnType<typeof useTranslations<"agentKnowledge">>

/** The formatter of the dates of the sources. */
export type Format = ReturnType<typeof useFormatter>

/** Where the words and the links of the tab come from: the workspace of the url. */
export interface ViewScope {
    readonly workspaceId: string
}

/** A command that opens another page: its words and where it goes. */
export interface LinkView {
    readonly label: string
    readonly href: string
}

/** One source of knowledge the agent reads. */
export interface SourceRowView {
    readonly id: string
    readonly icon: IconName
    readonly title: string
    readonly subline: string
    readonly kindLabel: string
    readonly updatedLabel: string
    readonly statusLabel: string
    readonly isRead: boolean
    readonly hasWaiting: boolean
    readonly href: string
}

/** One sample answer: the question and what the agent says. */
export interface AnswerRowView {
    readonly id: string
    readonly question: string
    readonly answer: string
    readonly waitingLabel: string
}

/** Everything the knowledge tab of one agent draws, every word resolved. */
export interface AgentKnowledgeView {
    readonly banner: (LinkView & { readonly heading: string; readonly title: string; readonly body: string; readonly count: string }) | null
    readonly sources: {
        readonly title: string
        readonly add: LinkView
        readonly columns: { readonly source: string; readonly kind: string; readonly updated: string; readonly status: string }
        readonly rows: ReadonlyArray<SourceRowView>
        readonly empty: string
    }
    readonly answers: {
        readonly title: string
        readonly add: LinkView
        readonly rows: ReadonlyArray<AnswerRowView>
        readonly empty: string
    }
}

type Doc = AgentKnowledgeData["documents"][number]

const KIND_ICON: Readonly<Record<string, IconName>> = {
    file: "document",
    text: "document",
    url: "explore",
    web: "explore",
    website: "explore",
    zalo: "chat",
}

const KIND_WORD: Readonly<Record<string, "kindFile" | "kindText" | "kindWeb" | "kindZalo">> = {
    file: "kindFile",
    text: "kindText",
    url: "kindWeb",
    web: "kindWeb",
    website: "kindWeb",
    zalo: "kindZalo",
}

const kindLabelOf = (t: Translate, kind: string): string => {
    const word = KIND_WORD[kind]
    return word === undefined ? t("kindOther") : t(word)
}

const statusOf = (t: Translate, doc: Doc): string => {
    if (!doc.isRead) return t("docNotRead")
    return doc.waitingFacts > 0 ? t("factsWaiting", { count: doc.waitingFacts }) : t("statusSynced")
}

const sublineOf = (t: Translate, doc: Doc): string =>
    doc.approvedFacts > 0 ? t("factsApproved", { count: doc.approvedFacts }) : t("factsNone")

const sourceRowOf = (t: Translate, format: Format, scope: ViewScope, doc: Doc): SourceRowView => ({
    id: doc.id,
    icon: KIND_ICON[doc.kind] ?? "document",
    title: doc.title,
    subline: sublineOf(t, doc),
    kindLabel: kindLabelOf(t, doc.kind),
    updatedLabel: format.dateTime(new Date(doc.updatedAt), { dateStyle: "short", timeStyle: "short" }),
    statusLabel: statusOf(t, doc),
    isRead: doc.isRead,
    hasWaiting: doc.isRead && doc.waitingFacts > 0,
    href: workspaceHref(scope.workspaceId, knowledgeSourceHref(doc.id)),
})

const bannerOf = (t: Translate, scope: ViewScope, data: AgentKnowledgeData): AgentKnowledgeView["banner"] => {
    if (data.waitingFacts === 0) return null
    const isCustomer = data.audience === "customer"
    return {
        heading: t("attentionTitle"),
        count: String(data.waitingFacts),
        title: t(isCustomer ? "waitingTitlePublic" : "waitingTitle", { count: data.waitingFacts, agent: data.name }),
        body: t(isCustomer ? "waitingBodyPublic" : "waitingBodyTeam", { agent: data.name }),
        label: t("waitingAction"),
        href: workspaceHref(scope.workspaceId, brainTabHref("todo")),
    }
}

/** What the knowledge tab of one agent draws, from what the back end says the agent reads. */
export const knowledgeViewOf = (
    t: Translate,
    format: Format,
    scope: ViewScope,
    data: AgentKnowledgeData,
): AgentKnowledgeView => ({
    banner: bannerOf(t, scope, data),
    sources: {
        title: t("sourcesTitle"),
        add: { label: t("sourcesAdd"), href: workspaceHref(scope.workspaceId, brainTabHref("sources", { add: "upload" })) },
        columns: { source: t("colSource"), kind: t("colKind"), updated: t("colUpdated"), status: t("colStatus") },
        rows: data.documents.map((doc) => sourceRowOf(t, format, scope, doc)),
        empty: t("sourcesEmpty", { agent: data.name }),
    },
    answers: {
        title: t("answersTitle"),
        add: { label: t("answersAdd"), href: workspaceHref(scope.workspaceId, brainTabHref("facts", { fact: "new" })) },
        rows: data.ownFacts.map((fact) => ({
            id: fact.id,
            question: fact.label,
            answer: fact.value,
            waitingLabel: fact.isApproved ? "" : t("ownWaiting"),
        })),
        empty: t("answersEmpty", { agent: data.name }),
    },
})
