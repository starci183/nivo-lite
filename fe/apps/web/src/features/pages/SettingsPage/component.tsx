import { Page, Stack, type PageHeaderContent } from "@starci/grammar/common"
import { ThemeSettings } from "@/components/blocks/ThemeSettings"
import { WorkspaceSettings } from "@/components/blocks/WorkspaceSettings"

/** The header the settings page supplies, and which of its two tabs the route shows. */
export interface SettingsPageBaseProps {
    readonly props: {
        readonly header: PageHeaderContent
        /** `general`: the name, time zone and logo; `theme`: the workspace's colours, font and corners. */
        readonly view: "general" | "theme"
    }
}

/** Draws the workspace settings screen: the header band with its two tabs, then the cards of the tab the route opened. */
export const SettingsPageBase = (props: SettingsPageBaseProps) => (
    <Page header={props.props.header} measure="product">
        <Stack gap="region">{props.props.view === "theme" ? <ThemeSettings /> : <WorkspaceSettings />}</Stack>
    </Page>
)
