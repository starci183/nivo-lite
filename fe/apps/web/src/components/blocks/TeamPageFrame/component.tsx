import type { ReactNode } from "react"
import { Page } from "@starci/grammar/common"
import { APP_ROUTES } from "@/modules/routes"
import type { TeamPageHeading } from "@/modules/types"

/** Atomic words and capabilities of the team's Page, plus its one-level owner content. */
export interface TeamPageFrameBaseProps {
    readonly children: ReactNode
    readonly props: {
        readonly heading: TeamPageHeading
        readonly selected: "members" | "permissions"
        readonly canManage: boolean
        readonly tabsLabel: string
        readonly membersLabel: string
        readonly permissionsLabel: string
    }
    readonly on: { readonly select: (id: string) => void }
}

/** The native header retains both manager-only tabs, the existing home trail and optional team eyebrow. */
export const TeamPageFrameBase = (props: TeamPageFrameBaseProps) => {
    const view = props.props
    const heading = view.heading
    return (
        <Page
            measure="product"
            header={{
                title: heading.title,
                description: heading.description,
                breadcrumbs: {
                    label: heading.crumbLabel,
                    items: [
                        { id: "home", label: heading.crumbHome, href: APP_ROUTES.dashboard },
                        { id: "current", label: heading.title },
                    ],
                },
                ...(heading.eyebrow === undefined ? {} : { meta: heading.eyebrow }),
                ...(view.canManage
                    ? {
                          tabs: {
                              label: view.tabsLabel,
                              selectedKey: view.selected,
                              labelVisibility: "always",
                              items: [
                                  { id: "members", label: view.membersLabel },
                                  { id: "permissions", label: view.permissionsLabel },
                              ],
                              onSelect: props.on.select,
                          },
                      }
                    : {}),
            }}
        >
            {props.children}
        </Page>
    )
}
