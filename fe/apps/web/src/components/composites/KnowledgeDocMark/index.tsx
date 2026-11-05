import { IconTile } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { IconName } from "@/components/leaves/Icon"
import type { DocGlyph } from "@/modules/types"

/** The glyph of each kind of row. */
const DOC_GLYPH: Readonly<Record<DocGlyph, IconName>> = {
    file: "document",
    text: "textNote",
    faq: "chat",
    url: "link",
    nivo: "talents",
    public: "view",
    search: "search",
}

/** What the mark of a document draws. */
interface KnowledgeDocMarkProps {
    readonly glyph: DocGlyph
}

/** The mark of a document: what it is (a file, a note, a Q&A list, a link, the base knowledge) as a glyph on a neutral tile. */
export const KnowledgeDocMark = (props: KnowledgeDocMarkProps) => (
    <IconTile source={nivoIconSource(DOC_GLYPH[props.glyph], "leading")} tone="neutral" />
)
