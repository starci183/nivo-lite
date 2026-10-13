import { getFormatter, getTranslations } from "next-intl/server"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { loadAgentDashboard } from "@/lib/agent-dashboard"
import { workbenchHref } from "@/lib/agent-dashboard-shared"
import { PRODUCT_TIME_ZONE } from "@/modules/i18n"
import { readContentWorkbench } from "@/modules/db"
import type { ContentFigures } from "@/modules/content"
import { ContentWorkbenchFailure, ContentWorkbenchPageBase } from "./component"

/** Props of {@link ContentWorkbenchPage}. */
export interface ContentWorkbenchPageProps {
    /** `?tab=` from the route (calendar, list, queue, balance, settings); anything else opens the first tab. */
    readonly tab?: string | null
    /** `?focus=` from the route: a post (or the decision of a post) to open in the editor. */
    readonly focus?: string | null
}

type Translate = Awaited<ReturnType<typeof getTranslations>>
type FormatWhen = (iso: string) => string

const ribbon = (figures: ContentFigures | null, t: Translate, when: FormatWhen): Array<DescriptionListStatItem> => {
    if (figures === null) return []
    return [
        {
            id: "waiting",
            term: t("ctWaiting"),
            description: String(figures.awaitingApproval),
            meta: t("ctWaitingMeta"),
        },
        {
            id: "published",
            term: t("ctPublished"),
            description: String(figures.published30),
            meta: t("ctPublishedMeta"),
        },
        figures.next
            ? { id: "next", term: t("ctNext"), description: when(figures.next.at), meta: figures.next.title }
            : { id: "next", term: t("ctNext"), description: "-", meta: t("ctNextNoneMeta") },
        figures.pillars.total > 0
            ? {
                  id: "pillars",
                  term: t("ctPillars"),
                  description: `${figures.pillars.covered}/${figures.pillars.total}`,
                  meta: t("ctPillarsMeta"),
              }
            : { id: "pillars", term: t("ctPillars"), description: "-", meta: t("ctPillarsNone") },
    ]
}

/**
 * The Content workbench (/agents/content/workbench): the agent dashboard frame around calendar, list, approvals, balance and settings,
 * with "Plan the month" as the page command. Reads with the member's own session and still renders when the data is not ready.
 */
const ContentWorkbenchPage = async (props: ContentWorkbenchPageProps = {}) => {
    const t = await getTranslations("content")
    const figuresText = await getTranslations("workbenchFigures")
    const format = await getFormatter()
    // Every waiting post is something to approve: a "waiting for you" row opens the Approvals tab.
    const dashboard = await loadAgentDashboard("content", {
        decisionHref: (item) => workbenchHref("content", { tab: "queue", focus: item.id }),
    })
    const read = await readContentWorkbench()
    if (read.kind !== "ok") {
        return (
            <ContentWorkbenchFailure
                props={{
                    dashboard,
                    tabLabel: t("tabCalendar"),
                    title: t("loadFailedTitle"),
                    body: t("loadFailedBody"),
                }}
            />
        )
    }
    const data = read.value
    const waiting = data.items.filter((i) => i.status === "waiting_approval").length
    const when: FormatWhen = (iso) =>
        format.dateTime(new Date(iso), {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: PRODUCT_TIME_ZONE,
        })
    const focus = props.focus ?? null
    return (
        <ContentWorkbenchPageBase
            props={{
                dashboard,
                data,
                figures: ribbon(data.figures, figuresText, when),
                initialTab: props.tab ?? null,
                focused:
                    focus === null
                        ? null
                        : (data.items.find((i) => i.id === focus || i.work_item_id === focus) ?? null),
                labels: {
                    calendar: t("tabCalendar"),
                    list: t("tabList"),
                    queue: `${t("tabQueue")}${waiting > 0 ? ` (${waiting})` : ""}`,
                    balance: t("tabBalance"),
                    settings: t("tabSettings"),
                    readOnly: t("readOnly"),
                },
            }}
        />
    )
}

export default ContentWorkbenchPage
