import type { ReactNode } from "react"
import { useBlockHost } from "@nivo-lite/agent-sdk/client"
import { Link } from "@starci/grammar/common"
import type { linkBlock } from "../../blocks/link.block"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** One link to a page of the app. */
export const LinkBlock = (props: RenderOf<typeof linkBlock>): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    return (
        <Link href={host.navigation.href(props.props.path)} variant="plain">
            {words(props.props.label)}
        </Link>
    )
}
