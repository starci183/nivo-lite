import { Children } from "react"
import type { ReactNode } from "react"
import { EmptyNotice, Grid, SurfaceCard } from "@starci/grammar/common"
import type { masterDetailBlock } from "../../blocks/master-detail.block"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** A list with the detail of the chosen record beside it on a wide screen and under it on a phone. */
export const MasterDetailBlock = (props: RenderOf<typeof masterDetailBlock>): ReactNode => {
    const words = useBlockWords()
    const [list = null, detail = null] = Children.toArray(props.children)
    const title = words(props.props.emptyTitle)
    return (
        <Grid
            kind="main-rail"
            primary={list}
            rail={
                detail === null ? (
                    <SurfaceCard ariaLabel={title}>
                        <EmptyNotice message={title} description={words(props.props.emptyBody)} />
                    </SurfaceCard>
                ) : (
                    detail
                )
            }
            railWidth="wide"
            align="start"
        />
    )
}
