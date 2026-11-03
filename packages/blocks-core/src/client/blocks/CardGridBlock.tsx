import type { ReactNode } from "react"
import { Grid } from "@starci/grammar/common"
import type { cardGridBlock } from "../../blocks/card-grid.block"
import type { RenderOf } from "../render-props"

/** Lays the child blocks out as a grid of cards. */
export const CardGridBlock = (props: RenderOf<typeof cardGridBlock>): ReactNode => (
    <Grid kind="cards">{props.children}</Grid>
)
