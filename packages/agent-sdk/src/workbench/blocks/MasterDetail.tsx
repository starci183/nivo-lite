import { EmptyNotice, Grid, SurfaceCard } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** A record list and the detail of the chosen record. */
export interface MasterDetailProps {
    /** The list: its own card, search and rows. */
    readonly list: ReactNode
    /** The detail of the chosen record; null when none is chosen, which draws the empty card. */
    readonly detail: ReactNode
    /** The anchor the list scrolls to on a phone, where the detail stands under the list. */
    readonly detailId: string
    /** What the detail card says while no record is chosen. */
    readonly empty: { readonly title: string; readonly body: string }
    readonly isLoading: boolean
}

/** A list with the detail of the chosen record beside it on a wide screen and under it on a phone. */
export const MasterDetail = (props: MasterDetailProps): ReactNode => (
    <Grid
        kind="main-rail"
        primary={props.list}
        rail={
            <div id={props.detailId}>
                {props.detail === null ? (
                    <SurfaceCard isLoading={props.isLoading} ariaLabel={props.empty.title}>
                        <EmptyNotice message={props.empty.title} description={props.empty.body} />
                    </SurfaceCard>
                ) : (
                    props.detail
                )}
            </div>
        }
        railWidth="wide"
        align="start"
    />
)
