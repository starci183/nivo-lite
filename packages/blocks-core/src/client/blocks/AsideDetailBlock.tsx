import { Children, type ReactNode } from "react"
import { Grid } from "@starci/grammar/common"
import type { asideDetailBlock } from "../../blocks/aside-detail.block"
import type { RenderOf } from "../render-props"

/** The main content with an aside beside it on a wide screen and under it on a phone. */
export const AsideDetailBlock = (props: RenderOf<typeof asideDetailBlock>): ReactNode => {
    const [main = null, aside = null] = Children.toArray(props.children)
    return (
        <Grid kind="main-rail" primary={main} rail={aside} railWidth={props.props.width ?? "standard"} align="start" />
    )
}
