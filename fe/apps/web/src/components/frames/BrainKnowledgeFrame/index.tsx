import type { ReactNode } from "react"
import { Page, Stack } from "@starci/grammar/common"
import { BrainHeaderActions, brainHeaderTabs } from "@/components/composites/BrainHeaderActions"
import { brainHeaderSubTabs } from "@/components/composites/BrainKnowledgeChips"
import type { BrainPageHeaderView } from "@/modules/types"

/** What the knowledge frame draws around the page of a chip. */
interface BrainKnowledgeFrameProps {
    readonly header: BrainPageHeaderView
    readonly onSelectTab: (id: string) => void
    /** The page of the chip: the documents or the facts, drawn as tables. */
    readonly children: ReactNode
}

/**
 * A page of the knowledge tab drawn as tables: the Second Brain header with its four tabs and its command, with the chips (documents,
 * facts, lessons) as its second tab row, and the page of the chosen chip under it, full width so no title is cut.
 */
export const BrainKnowledgeFrame = (props: BrainKnowledgeFrameProps) => {
    const { header } = props
    return (
        <Page
            header={{
                ...header.heading,
                actions: <BrainHeaderActions add={header.actions.add} />,
                tabs: brainHeaderTabs({ tabs: header.tabs, onSelect: props.onSelectTab }),
                ...brainHeaderSubTabs(header.chips),
            }}
            measure="product"
        >
            <Stack gap="section">{props.children}</Stack>
        </Page>
    )
}
