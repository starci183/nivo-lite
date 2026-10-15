import { Alert, EmptyNotice, PageContainer, SectionHeader, Skeleton, TextAction } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ConnectionsHead } from "@/components/composites/ConnectionsHead"
import { connectionsPageClassNames as classNames } from "./classNames"
import { ConnectionsLists } from "./component"
import type { ConnectionsOverviewProps } from "./component"

const headOf = (props: ConnectionsOverviewProps["props"], withSummary: boolean) => (
    <ConnectionsHead
        crumbLabel={props.words.crumbLabel}
        homeLabel={props.words.crumbHome}
        homeHref={props.words.homeHref}
        title={props.words.title}
        description={props.words.description}
        {...(withSummary ? { meta: props.words.summary } : {})}
    />
)

/**
 * The Connections page: the trail and heading, the first connection that needs attention, the Connected / Library tabs, then either
 * the library or the provider lists grouped by what they bring in. The wizard and the connector detail open as drawers over it.
 */
export const ConnectionsOverview = (props: ConnectionsOverviewProps) => {
    const page = props.props
    if (page.mode === "forbidden") {
        return (
            <PageContainer measure="product">
                <div className={classNames.page}>
                    <SectionHeader level={1} title={page.words.forbiddenTitle} description={page.words.forbiddenBody} />
                    <TextAction href={page.words.forbiddenHref}>{page.words.forbiddenBack}</TextAction>
                </div>
            </PageContainer>
        )
    }
    if (page.mode === "loading") {
        return (
            <PageContainer measure="product">
                <div className={classNames.page}>
                    {headOf(page, false)}
                    <Skeleton shape="text" lines={4} />
                </div>
            </PageContainer>
        )
    }
    if (page.mode === "failed") {
        return (
            <PageContainer measure="product">
                <div className={classNames.page}>
                    {headOf(page, false)}
                    <Alert tone="negative" title={page.words.loadFailed} />
                </div>
            </PageContainer>
        )
    }
    return (
        <PageContainer measure="product">
            <div className={classNames.page}>
                {headOf(page, true)}
                {page.attention === null ? null : (
                    <props.renderAttention
                        connection={page.attention.first}
                        count={page.attention.count}
                        canManage={page.canManage}
                    />
                )}
                {page.canManage ? null : <Alert tone="informative" title={page.words.ownerOnly} />}
                <props.renderViewTabs selected={page.view} liveCount={page.liveCount} />
                {page.view === "library" ? <props.renderLibrary items={page.items} /> : null}
                {page.view === "connected" && page.liveCount === 0 ? (
                    <EmptyNotice message={page.words.emptyTitle} description={page.words.emptyHint} />
                ) : null}
                {page.view === "connected" ? (
                    <ConnectionsLists
                        props={page}
                        renderAddButton={props.renderAddButton}
                        renderRow={props.renderRow}
                    />
                ) : null}
                <TextAction href={page.words.automationsHref}>{page.words.automationsLink}</TextAction>
            </div>
        </PageContainer>
    )
}

/** The feature host supplies the registered drawers and their readiness. */
interface OverlayHostProps {
    readonly active: boolean
    readonly candidate: ReactNode
}

/** A pure host for the connection drawers; the feature owns their registration and lifecycle. */
export const OverlayHost = (props: OverlayHostProps) => <>{props.active ? props.candidate : null}</>
