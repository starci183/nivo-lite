import { Page } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import {
    connectionBandOf,
    connectionTabsOf,
    type ConnectionPageAction,
    type ConnectionPageChip,
    type ConnectionBandHeader,
} from "@/components/frames/ConnectionBand"
import { ConnectionRowQuestions, rowMenuEntriesOf, type RowCommandSet } from "@/components/frames/ConnectionRowBody"
import type { ConnectionRefusalView, ProviderPageTabsView, RowView } from "@/modules/types"

/** The words and the state of the band of a connection without a page of its own. */
export interface ConnectionOpenHeadBaseProps {
    /** The routed page: the open tab body, drawn under the band. */
    readonly children: ReactNode
    readonly props: {
        /** The connection's view; absent while it is read. */
        readonly view?: RowView
        /** The status badge in the shared vocabulary; absent while the connection is read. */
        readonly chip?: ConnectionPageChip
        readonly glyph: "email" | "apps"
        readonly crumbsLabel: string
        readonly crumbs: ConnectionBandHeader["crumbs"]
        readonly tabs: ProviderPageTabsView
        readonly moreLabel: string
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
        /** The account form's two commands, when the page has the form: check the connection (neutral), save (the page's one red command). */
        readonly form?: {
            readonly check?: ConnectionPageAction
            readonly save?: ConnectionPageAction
        }
    }
    readonly on: RowCommandSet
}

/** The row's one primary command as the band's action. */
const actionOf = (view: RowView, on: RowCommandSet): ConnectionPageAction | undefined => {
    const primary = view.primary
    return primary === null
        ? undefined
        : {
              label: primary.label,
              intent: primary.intent,
              isPending: primary.isPending,
              onPress: () => on.primary(primary.id),
          }
}

/**
 * Draws the band of a connection that has no page of its own (outgoing email, a webhook, Google Sheets, a data source): trail, mark,
 * name, status badge, facts, the row's one primary command, the row's menu, the tabs, and the two destructive questions the menu opens.
 */
export const ConnectionOpenHeadBase = (props: ConnectionOpenHeadBaseProps) => {
    const { view, chip, refusal } = props.props
    const isRefused = refusal !== undefined
    const env = view?.envLabel ?? null
    const checkIsForm = props.props.form?.check !== undefined
    const action =
        view === undefined || isRefused || (checkIsForm && view.primary?.id === "check") ? undefined : actionOf(view, props.on)
    const form = isRefused ? undefined : props.props.form
    const header: ConnectionBandHeader = {
        crumbsLabel: props.props.crumbsLabel,
        crumbs: props.props.crumbs,
        title: refusal?.title ?? view?.title ?? "",
        mark: <ProviderLogo {...(view?.logo ?? { isWordmark: false })} glyph={props.props.glyph} />,
        chips: [
            ...(chip === undefined || isRefused ? [] : [chip]),
            ...(env === null || isRefused ? [] : [{ label: env, tone: "neutral" as const }]),
        ],
        facts: view === undefined || isRefused ? "" : [view.facts, view.usedBy].filter(Boolean).join(" · "),
        ...(action === undefined ? {} : { action }),
        ...(form === undefined ? {} : { extras: [form.check, form.save].filter((a): a is ConnectionPageAction => a !== undefined) }),
        ...(view === undefined || isRefused
            ? {}
            : { menu: { label: props.props.moreLabel, entries: rowMenuEntriesOf(view, props.on.menu) } }),
        tabs: {
            label: props.props.tabs.label,
            selectedKey: props.props.tabs.selectedKey,
            items: props.props.tabs.items,
        },
        ...(view === undefined ? {} : { question: <ConnectionRowQuestions view={view} on={props.on} /> }),
    }
    return (
        <Page
            header={{ ...connectionBandOf(header), tabs: connectionTabsOf(header) }}
            measure="product"
            isLoading={!isRefused && view === undefined}
        >
            {props.children}
        </Page>
    )
}
