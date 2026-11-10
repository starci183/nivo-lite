import { EmptyNotice, Section } from "@starci/grammar/common"
import type { BadgeTone, ListRowData } from "@starci/grammar/common"

/** One service of the Google account: what it is, where it stands, the badge and the one command it needs. */
export interface GoogleServiceRow {
    readonly id: string
    readonly title: string
    readonly description: string
    /** The service's own mark, drawn where the other connection rows draw their provider's. */
    readonly logo: string
    readonly badge?: { readonly label: string; readonly tone: BadgeTone; readonly isDot?: boolean }
    /** Absent on a service that is not available yet. */
    readonly action?: { readonly label: string; readonly run: () => void }
}

/** What the services card draws. */
interface GoogleServicesCardProps {
    /** "Services of this account", already in the reader's language. */
    readonly title: string
    /** The short rule beside the title (switching a service on asks Google for exactly its permission). */
    readonly hint: string
    readonly services: ReadonlyArray<GoogleServiceRow>
}

/** The services of one Google account as a list card: a row each with its state badge and its one command. */
export const GoogleServicesCard = (props: GoogleServicesCardProps) => (
    <Section
        kind="list"
        title={props.title}
        fact={props.hint}
        items={props.services.map((service): ListRowData => ({
            id: service.id,
            title: service.title,
            description: service.description,
            leading: { avatar: { name: service.title, src: service.logo, shape: "square" }, size: "md" },
            ...(service.badge === undefined
                ? {}
                : {
                      badges: [
                          {
                              label: service.badge.label,
                              tone: service.badge.tone,
                              ...(service.badge.isDot === true ? { isDot: true } : {}),
                          },
                      ],
                  }),
            ...(service.action === undefined
                ? {}
                : { action: { label: service.action.label, press: service.action.run } }),
        }))}
        empty={<EmptyNotice message={props.title} />}
    />
)
