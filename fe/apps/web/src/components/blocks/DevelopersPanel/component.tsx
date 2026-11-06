import { Button, EmptyNotice, Icon, Page, Section, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { nivoIconSource } from "@/components/leaves/Icon"

/** One outgoing webhook as the list shows it. */
export interface DevelopersWebhookRow {
    readonly id: string
    readonly name: string
    /** The masked address and the chosen events, in one line. */
    readonly description: string
    /** The wizard was started and not finished: the row offers to continue it. */
    readonly isIncomplete: boolean
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
    readonly continueLabel: string
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

/** What the connected rows draw: the list's props without the add command, which the section head carries. */
type ConnectedWebhooksProps = Omit<DevelopersWebhooksProps, "onAdd">

/** The outgoing webhooks: the connected ones as rows of one list, or the provider offered under "Not connected". */
const DevelopersWebhooks = (props: DevelopersWebhooksProps) => (
    <div data-guide="connections.webhook">
        {props.rows.length > 0 ? (
            <ConnectedWebhooks
                rows={props.rows}
                canManage={props.canManage}
                view={props.view}
                isLoading={props.isLoading}
                onEdit={props.onEdit}
            />
        ) : (
            <AvailableWebhook
                canManage={props.canManage}
                view={props.view}
                isLoading={props.isLoading}
                onAdd={props.onAdd}
            />
        )}
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
        readonly homeHref: string
        readonly title: string
        readonly description: string
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
                    { id: "home", label: props.props.crumbHome, href: props.props.homeHref },
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
                    <Section
                        title={props.props.eventsTitle}
                        {...(props.props.canManageWebhooks && props.props.webhooks.length > 0
                            ? {
                                  action: (
                                      <Button
                                          intent="neutral"
                                          startContent={
                                              <Icon source={nivoIconSource("add", "leading")} usage="leading" />
                                          }
                                          onPress={props.on.add}
                                      >
                                          {props.props.webhooksView.addLabel}
                                      </Button>
                                  ),
                              }
                            : {})}
                    >
                        <Stack gap="row">
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
                            <Text size="xs" tone="muted">
                                {props.props.eventsBody}
                            </Text>
                        </Stack>
                    </Section>
                )}
            />
            {props.children}
        </Stack>
    </Page>
)

/** Draws the connected outgoing webhook rows and their available actions. */
const ConnectedWebhooks = (props: ConnectedWebhooksProps) => (
    <SurfaceCard
        kind="list"
        ariaLabel={props.view.title}
        isLoading={props.isLoading}
        items={props.rows.map((row) => ({
            id: row.id,
            title: row.name,
            description: row.description,
            ...(props.view.logo === undefined
                ? {}
                : { leading: { avatar: { name: props.view.title, src: props.view.logo } } as const }),
            badges: [{ label: row.statusLabel, tone: row.tone, isDot: true }],
            ...(props.canManage && row.isIncomplete
                ? {
                      action: {
                          label: props.view.continueLabel,
                          intent: "neutral",
                          press: () => props.onEdit(row.id),
                      } as const,
                  }
                : {}),
            ...(props.canManage && !row.isIncomplete
                ? {
                      menu: {
                          label: props.view.editLabel,
                          entries: [{ id: "edit", label: props.view.editLabel, onAction: () => props.onEdit(row.id) }],
                      },
                  }
                : {}),
        }))}
        empty={<EmptyNotice message={props.view.notConnected} />}
    />
)

/** Offers the provider connection when no outgoing webhook exists. */
const AvailableWebhook = (props: Pick<DevelopersWebhooksProps, "canManage" | "view" | "isLoading" | "onAdd">) => (
    <SurfaceCard
        kind="list"
        isLoading={props.isLoading}
        ariaLabel={props.view.notConnected}
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
