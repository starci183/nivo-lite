import type { ReactNode } from "react"
import { Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { sectionBlock } from "../../blocks/section.block"
import { InSurfaceProvider } from "../composites/InSurface"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** A titled card: an optional hint over the stacked child blocks. */
export const SectionBlock = (props: RenderOf<typeof sectionBlock>): ReactNode => {
    const words = useBlockWords()
    const hint = props.props.hint
    return (
        <SurfaceCard label={words(props.props.title)} headingLevel={2}>
            <Stack gap="row">
                {hint === undefined ? null : (
                    <Text size="sm" tone="muted">
                        {words(hint)}
                    </Text>
                )}
                <InSurfaceProvider value>
                    <Stack gap="row">{props.children}</Stack>
                </InSurfaceProvider>
            </Stack>
        </SurfaceCard>
    )
}
