import { Page, Stack, WorkspaceShell } from "@starci/grammar/common"
import { BrandLogo } from "@/components/blocks/BrandLogo"
import { InviteOverview } from "@/components/blocks/InviteOverview"

/** Props for {@link InvitePageBase}. */
export interface InvitePageBaseProps {
    readonly props: {
        readonly token: string
        readonly label: string
    }
}

/** Draws the invitation page: the logo and the connected invitation card, centred in the shell. */
export const InvitePageBase = (props: InvitePageBaseProps) => (
    <WorkspaceShell
        align="stretch"
        primaryLabel={props.props.label}
        primary={
            <Page measure="reading">
                <Stack gap="section" measure="form">
                    <BrandLogo variant="full" height={40} />
                    <InviteOverview token={props.props.token} />
                </Stack>
            </Page>
        }
    />
)
