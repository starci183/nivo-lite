import { Breadcrumbs, PageContainer, SectionHeader, TextAction } from "@starci/grammar/common"
import { ApiKeysSection } from "@/components/blocks/ApiKeysSection"
import { ApiQuickStart } from "@/components/blocks/ApiQuickStart"
import { ConnectionsBoard } from "@/features/connections/ConnectionsBoard"
import type { Connection } from "@/lib/channels"
import { APP_ROUTES } from "@/modules/routes"
import { HEAD_CLASS, PAGE_CLASS, STACK_CLASS } from "./classNames"

/** Props for {@link DevelopersPageBase}. */
export interface DevelopersPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly backLabel: string
        readonly eventsTitle: string
        readonly eventsBody: string
        readonly webhooks: ReadonlyArray<Connection>
        readonly canManageWebhooks: boolean
        readonly apiBase: string
    }
}

/** Draws the "Advanced" page body: outgoing events, API keys and the quick guide. */
export const DevelopersPageBase = (props: DevelopersPageBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS}>
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
                    items={props.props.webhooks}
                    agentNames={{}}
                    agents={[]}
                    localOnly={false}
                    ownerEmail=""
                    groups={[{ id: "tools", providers: ["webhook"] }]}
                    isEmbedded
                    canManage={props.props.canManageWebhooks}
                />
            </div>
            <ApiKeysSection />
            <ApiQuickStart base={props.props.apiBase} />
        </div>
    </PageContainer>
)

/** Props for {@link DevelopersForbiddenBase}. */
export interface DevelopersForbiddenBaseProps {
    readonly props: {
        readonly eyebrow: string
        readonly title: string
        readonly body: string
        readonly backLabel: string
    }
}

/** Draws the friendly 403 staff see. */
export const DevelopersForbiddenBase = (props: DevelopersForbiddenBaseProps) => (
    <PageContainer measure="product">
        <div className={PAGE_CLASS}>
            <SectionHeader
                level={1}
                eyebrow={props.props.eyebrow}
                title={props.props.title}
                description={props.props.body}
            />
            <div>
                <TextAction href={APP_ROUTES.chat} size="sm">
                    {props.props.backLabel}
                </TextAction>
            </div>
        </div>
    </PageContainer>
)
