import { Badge, Breadcrumbs, Button, ListRow, SectionHeader, SurfaceListCard, TextAction } from "@starci/grammar/common"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import { APP_ROUTES } from "@/modules/routes"
import { HEAD_CLASS, STACK_CLASS } from "./classNames"

/** One outgoing webhook as the list shows it. */
export interface DevelopersWebhookRow {
    readonly id: string
    readonly name: string
    readonly statusLabel: string
    readonly tone: "success" | "danger" | "warning" | "neutral"
}

/** The outgoing-webhook provider as the page lists it: its rows when connected, else one row that offers to connect it. */
export interface DevelopersWebhooksView {
    readonly title: string
    /** "n connected", shown on the list of connected webhooks. */
    readonly fact: string
    /** The provider's one-line description, on the "Not connected" row. */
    readonly blurb: string
    readonly notConnected: string
    /** The provider's logo, when it has one. */
    readonly logo: string | undefined
    readonly addLabel: string
    readonly connectLabel: string
    readonly editLabel: string
}

/** What the webhook list draws and the commands it offers (both open the wizard drawer through the URL). */
interface DevelopersWebhooksProps {
    readonly rows: ReadonlyArray<DevelopersWebhookRow>
    readonly canManage: boolean
    readonly view: DevelopersWebhooksView
    readonly onAdd: () => void
    readonly onEdit: (connectionId: string) => void
}

/** The outgoing webhooks: the connected ones as rows of one list, or the provider offered under "Not connected". */
const DevelopersWebhooks = (props: DevelopersWebhooksProps) => (
    <div data-guide="connections.webhook">
        {props.rows.length > 0 ? <ConnectedWebhooks {...props} /> : <AvailableWebhook {...props} />}
    </div>
)

/** Props for {@link DevelopersPanelBase}. */
export interface DevelopersPanelBaseProps {
    readonly state: {
        /** Owner or manager: the page; staff: the friendly 403. */
        readonly isAllowed: boolean
        readonly webhooks: ReadonlyArray<DevelopersWebhookRow>
        readonly canManageWebhooks: boolean
        readonly webhooksView: DevelopersWebhooksView
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
    readonly on: {
        /** Opens the wizard of a new outgoing webhook. */
        readonly add: () => void
        /** Opens the wizard on one outgoing webhook. */
        readonly edit: (connectionId: string) => void
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
                <DevelopersWebhooks
                    rows={props.state.webhooks}
                    canManage={props.state.canManageWebhooks}
                    view={props.state.webhooksView}
                    onAdd={props.on.add}
                    onEdit={props.on.edit}
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

/** Draws the connected outgoing webhook rows and their available actions. */
const ConnectedWebhooks = (props: DevelopersWebhooksProps) => (
    <SurfaceListCard
        label={props.view.title}
        headingLevel={3}
        fact={props.view.fact}
        {...(props.canManage
            ? {
                  labelEnd: (
                      <Button variant="ghost" onPress={props.onAdd}>
                          {props.view.addLabel}
                      </Button>
                  ),
              }
            : {})}
    >
        {props.rows.map((row) => (
            <ListRow
                key={row.id}
                title={row.name}
                badges={<Badge tone={row.tone}>{row.statusLabel}</Badge>}
                {...(props.canManage
                    ? {
                          actions: (
                              <Button variant="outline" onPress={() => props.onEdit(row.id)}>
                                  {props.view.editLabel}
                              </Button>
                          ),
                      }
                    : {})}
            />
        ))}
    </SurfaceListCard>
)

/** Offers the provider connection when no outgoing webhook exists. */
const AvailableWebhook = (props: Pick<DevelopersWebhooksProps, "canManage" | "view" | "onAdd">) => (
    <SurfaceListCard label={props.view.notConnected} headingLevel={3}>
        <ListRow
            leading={
                <ProviderLogo glyph="email" {...(props.view.logo === undefined ? {} : { src: props.view.logo })} />
            }
            title={props.view.title}
            description={props.view.blurb}
            {...(props.canManage
                ? {
                      actions: (
                          <Button variant="outline" onPress={props.onAdd}>
                              {props.view.connectLabel}
                          </Button>
                      ),
                  }
                : {})}
        />
    </SurfaceListCard>
)
