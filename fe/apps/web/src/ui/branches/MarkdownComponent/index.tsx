import { Heading, Text } from "@starci/grammar/common";



/** Raw Markdown subset accepted by the safe renderer. */
export type MarkdownComponentProps = { readonly markdown: string }
type MarkdownBlock = { readonly kind: "heading"; readonly level: 2 | 3 | 4; readonly content: string } | { readonly kind: "text"; readonly content: string }
const blocks = (markdown: string): ReadonlyArray<MarkdownBlock> => markdown.trim().split(/\n\s*\n/gu).filter(Boolean).flatMap((value): ReadonlyArray<MarkdownBlock> => {
    if (value.startsWith("### ")) return [{ kind: "heading", level: 4, content: value.slice(4) }]
    if (value.startsWith("## ")) return [{ kind: "heading", level: 3, content: value.slice(3) }]
    if (value.startsWith("# ")) return [{ kind: "heading", level: 2, content: value.slice(2) }]
    return [{ kind: "text", content: value.replace(/^\x60\x60\x60[^\n]*\n?/u, "").replace(/\x60\x60\x60$/u, "") }]
})

/** Render the trusted Markdown subset without an HTML escape hatch. */
export const MarkdownComponent = (props: MarkdownComponentProps) => (
    <div>
        {blocks(props.markdown).map((item, index) => item.kind === "heading"
            ? <Heading key={`${String(index)}-${item.kind}`} level={item.level}>{item.content}</Heading>
            : <Text key={`${String(index)}-${item.kind}`} size="sm">{item.content}</Text>)}
    </div>
)
