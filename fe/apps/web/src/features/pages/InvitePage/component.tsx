import { Page, WorkspaceShell } from "@starci/grammar/common"
import { BrandLogo } from "@/components/blocks/BrandLogo"
import { InviteOverview } from "@/components/blocks/InviteOverview"
import { INVITE_COLUMN_CLASS_NAME } from "./classNames"

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
                <div className={INVITE_COLUMN_CLASS_NAME}>
                    <BrandLogo variant="full" height={40} />
                    <InviteOverview token={props.props.token} />
                </div>
            </Page>
        }
    />
)
