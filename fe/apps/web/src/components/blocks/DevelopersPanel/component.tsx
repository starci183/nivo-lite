import { Breadcrumbs, SectionHeader, TextAction } from "@starci/grammar/common"
import { ConnectionsBoard } from "@/features/connections/ConnectionsBoard"
import type { Connection } from "@/modules/types"
import { APP_ROUTES } from "@/modules/routes"
import { HEAD_CLASS, STACK_CLASS } from "./classNames"

/** Props for {@link DevelopersPanelBase}. */
export interface DevelopersPanelBaseProps {
    readonly state: {
        /** Owner or manager: the page; staff: the friendly 403. */
        readonly isAllowed: boolean
        readonly webhooks: ReadonlyArray<Connection>
        readonly canManageWebhooks: boolean
    }
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly backLabel: string
        readonly eventsTitle: string
        readonly eventsBody: string
        readonly forbiddenTitle: string
        readonly forbiddenBody: string
        readonly forbiddenBack: string
    }
}

/** Draws the head and the outgoing events of the "Advanced" page, or the friendly 403 staff see. */
export const DevelopersPanelBase = (props: DevelopersPanelBaseProps) =>
    props.state.isAllowed ? (
        <>
            <div className={HEAD_CLASS}>
                <Breadcrumbs
                    label={props.props.crumbLabel}
                    items={[
                        { id: "home", label: props.props.crumbHome, href: APP_ROUTES.dashboard },
                        { id: "developers", label: props.props.title },
                    ]}
                />
                <SectionHeader
                    level={1}
                    eyebrow={props.props.eyebrow}
                    title={props.props.title}
                    description={props.props.description}
                />
            </div>
            <div>
                <TextAction href={APP_ROUTES.automations} size="sm">
                    {props.props.backLabel}
                </TextAction>
            </div>
            <div className={STACK_CLASS}>
                <SectionHeader level={2} title={props.props.eventsTitle} description={props.props.eventsBody} />
                <ConnectionsBoard
                    items={props.state.webhooks}
                    agentNames={{}}
                    agents={[]}
                    localOnly={false}
                    ownerEmail=""
                    groups={[{ id: "tools", providers: ["webhook"] }]}
                    isEmbedded
                    canManage={props.state.canManageWebhooks}
                />
            </div>
        </>
    ) : (
        <>
            <SectionHeader
                level={1}
                eyebrow={props.props.eyebrow}
                title={props.props.forbiddenTitle}
                description={props.props.forbiddenBody}
            />
            <div>
                <TextAction href={APP_ROUTES.chat} size="sm">
                    {props.props.forbiddenBack}
                </TextAction>
            </div>
        </>
    )
