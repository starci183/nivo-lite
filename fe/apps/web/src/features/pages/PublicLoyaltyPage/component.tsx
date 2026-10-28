import { Page, WorkspaceShell } from "@starci/grammar/common"
import { LoyaltyCheckForm } from "@/components/blocks/LoyaltyCheckForm"
import { CANVAS_CLASS_NAME } from "./classNames"

/** Props for {@link PublicLoyaltyPageBase}. */
export interface PublicLoyaltyPageBaseProps {
    readonly props: {
        readonly slug: string
        readonly label: string
    }
}

/** Draws the public points page: a shell with one reading column holding the check form of the shop. */
export const PublicLoyaltyPageBase = (props: PublicLoyaltyPageBaseProps) => (
    <WorkspaceShell
        align="stretch"
        primaryLabel={props.props.label}
        primary={
            <Page measure="reading">
                <div className={CANVAS_CLASS_NAME}>
                    <LoyaltyCheckForm slug={props.props.slug} />
                </div>
            </Page>
        }
    />
)
