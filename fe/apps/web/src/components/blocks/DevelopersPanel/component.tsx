import { Button, EmptyNotice, Link, Page, Section, Stack, SurfaceCard } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { APP_ROUTES } from "@/modules/routes"

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
    /** The connections read is still on: the list rests as itself under its skeleton. */
    readonly isLoading: boolean
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
    /** The sections under the events: API keys and the quick guide, which hide themselves from staff. */
    readonly children: ReactNode
    readonly props: {
        /** Who may read the page: forbidden for staff, so the notice replaces the page; ready for managers. */
        readonly access: DataSlot<true>
        readonly webhooks: ReadonlyArray<DevelopersWebhookRow>
        readonly canManageWebhooks: boolean
        /** Where the connections read behind the webhooks stands. */
        readonly webhooksRead: DataSlot<true>
        readonly webhooksView: DevelopersWebhooksView
        readonly crumbLabel: string
        readonly crumbHome: string
        readonly title: string
        readonly description: string
        readonly backLabel: string
        readonly eventsTitle: string
        readonly eventsBody: string
        /** The words of the status notice; `forbidden` is what staff read. */
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        /** Reads the connections again after a failed read. */
        readonly retry: () => void
        /** Opens the wizard of a new outgoing webhook. */
        readonly add: () => void
        /** Opens the wizard on one outgoing webhook. */
        readonly edit: (connectionId: string) => void
    }
}

/** Draws the "Advanced" page: its header band, then in the body the outgoing events (or the forbidden notice staff see) and the sections. */
export const DevelopersPanelBase = (props: DevelopersPanelBaseProps) => (
    <Page
        measure="product"
        header={{
            breadcrumbs: {
                label: props.props.crumbLabel,
                items: [
                    { id: "home", label: props.props.crumbHome, href: APP_ROUTES.dashboard },
                    { id: "developers", label: props.props.title },
                ],
            },
            title: props.props.title,
            description: props.props.description,
        }}
    >
        <Stack gap="section">
            <SlotView
                slot={props.props.access}
                placeholder={true}
                labels={props.props.slotLabels}
                render={() => (
                    <Stack gap="row">
                        <div>
                            <Link href={APP_ROUTES.automations}>{props.props.backLabel}</Link>
                        </div>
                        <Section title={props.props.eventsTitle} description={props.props.eventsBody}>
                            <SlotView
                                slot={props.props.webhooksRead}
                                placeholder={true}
                                labels={props.props.slotLabels}
                                forbidden="hide"
                                onRetry={props.on.retry}
                                render={(_, isLoading) => (
                                    <DevelopersWebhooks
                                        rows={props.props.webhooks}
                                        canManage={props.props.canManageWebhooks}
                                        view={props.props.webhooksView}
                                        isLoading={isLoading}
                                        onAdd={props.on.add}
                                        onEdit={props.on.edit}
                                    />
                                )}
                            />
                        </Section>
                    </Stack>
                )}
            />
            {props.children}
        </Stack>
    </Page>
)

/** Draws the connected outgoing webhook rows and their available actions. */
const ConnectedWebhooks = (props: DevelopersWebhooksProps) => (
    <SurfaceCard
        kind="list"
        label={props.view.title}
        headingLevel={3}
        fact={props.view.fact}
        isLoading={props.isLoading}
        items={props.rows.map((row) => ({
            id: row.id,
            title: row.name,
            badges: [{ label: row.statusLabel, tone: row.tone }],
            ...(props.canManage
                ? {
                      action: {
                          label: props.view.editLabel,
                          intent: "neutral",
                          press: () => props.onEdit(row.id),
                      } as const,
                  }
                : {}),
        }))}
        empty={<EmptyNotice message={props.view.notConnected} />}
        {...(props.canManage
            ? {
                  labelEnd: (
                      <Button intent="neutral" onPress={props.onAdd}>
                          {props.view.addLabel}
                      </Button>
                  ),
              }
            : {})}
    />
)

/** Offers the provider connection when no outgoing webhook exists. */
const AvailableWebhook = (props: Pick<DevelopersWebhooksProps, "canManage" | "view" | "isLoading" | "onAdd">) => (
    <SurfaceCard
        kind="list"
        isLoading={props.isLoading}
        label={props.view.notConnected}
        headingLevel={3}
        items={[
            {
                id: "provider",
                ...(props.view.logo === undefined
                    ? {}
                    : { leading: { avatar: { name: props.view.title, src: props.view.logo } } as const }),
                title: props.view.title,
                description: props.view.blurb,
                ...(props.canManage
                    ? { action: { label: props.view.connectLabel, intent: "neutral", press: props.onAdd } as const }
                    : {}),
            },
        ]}
        empty={<EmptyNotice message={props.view.notConnected} />}
    />
)
