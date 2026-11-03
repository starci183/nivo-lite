import type { ReactNode } from "react"
import { Stack } from "@starci/grammar/common"
import type { stackBlock } from "../../blocks/stack.block"
import type { RenderOf } from "../render-props"

/** Stacks the child blocks with the gap the spec names. */
export const StackBlock = (props: RenderOf<typeof stackBlock>): ReactNode => (
    <Stack gap={props.props.gap}>{props.children}</Stack>
)
