import type { BrandProposalType } from "@/modules/api"

/** The brand kit as the owner confirms it (the `BrandKitInput` of the contract). */
export interface BrandKitDraft {
    readonly brandName: string
    readonly colors: ReadonlyArray<{ readonly name: string; readonly hex: string }>
    readonly fonts: ReadonlyArray<string>
    readonly tone: string
    readonly address: string
    readonly imagery: ReadonlyArray<string>
    readonly avoid: ReadonlyArray<string>
}

/** The kit as the edit holds it: plain text, one item per line for the lists. */
export interface BrandKitText {
    readonly brandName: string
    readonly colors: string
    readonly fonts: string
    readonly tone: string
    readonly address: string
    readonly imagery: string
    readonly avoid: string
}

/** One brand proposal card of the setup chat, ready to draw. */
export interface BrandProposalCardView {
    readonly id: string
    /** The one line of a decided proposal; empty while it waits. */
    readonly decidedLine: string
    readonly decidedLabel: string
    readonly decidedTone: "success" | "neutral"
    readonly head: string
    readonly waitingLabel: string
    readonly colorsLabel: string
    readonly colors: ReadonlyArray<{ readonly name: string; readonly hex: string }>
    readonly items: ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }>
    readonly isEditing: boolean
    readonly fields: BrandKitText
    readonly labels: BrandKitText
    readonly colorsHint: string
    readonly error: string
    readonly isPending: boolean
    readonly confirmLabel: string
    readonly editLabel: string
    readonly rejectLabel: string
}

/** The words of a brand proposal card, resolved by the caller from the marketing catalog. */
export interface BrandCardSay {
    readonly labels: BrandKitText
    readonly none: string
    readonly colorsHint: string
    readonly head: (brand: string, fileName: string) => string
    readonly decidedLine: (status: string, fileName: string) => string
    readonly status: (status: string) => string
    readonly confirm: string
    readonly edit: string
    readonly closeEdit: string
    readonly reject: string
}

/** What the card is doing now: whether its edit is open, its edit text, its first error and whether it is being settled. */
export interface BrandCardState {
    readonly isEditing: boolean
    readonly fields: BrandKitText
    readonly error: string
    readonly isPending: boolean
}

/** One color line of the edit: a name, a space, then `#rrggbb`. */
const COLOR_LINE = /^(.{1,40}?)\s+(#[0-9a-fA-F]{6})$/u

const linesOf = (text: string): ReadonlyArray<string> =>
    text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

/** Whether the text is at most `max` lines of at most `maxLength` characters each. */
export const isLineList = (text: string, max: number, maxLength: number): boolean => {
    const lines = linesOf(text)
    return lines.length <= max && lines.every((line) => line.length <= maxLength)
}

/** Whether every line names a color and its `#rrggbb` code, six at most. */
export const isColorList = (text: string): boolean => {
    const lines = linesOf(text)
    return lines.length <= 6 && lines.every((line) => COLOR_LINE.test(line))
}

/** The edit text of a kit. */
export const kitTextOf = (kit: BrandKitDraft): BrandKitText => ({
    brandName: kit.brandName,
    colors: kit.colors.map((color) => `${color.name} ${color.hex}`).join("\n"),
    fonts: kit.fonts.join("\n"),
    tone: kit.tone,
    address: kit.address,
    imagery: kit.imagery.join("\n"),
    avoid: kit.avoid.join("\n"),
})

/** The kit an edit stands for. */
export const kitOfText = (text: BrandKitText): BrandKitDraft => ({
    brandName: text.brandName.trim(),
    colors: linesOf(text.colors).flatMap((line) => {
        const match = COLOR_LINE.exec(line)
        return match === null ? [] : [{ name: (match[1] ?? "").trim(), hex: match[2] ?? "" }]
    }),
    fonts: linesOf(text.fonts),
    tone: text.tone.trim(),
    address: text.address.trim(),
    imagery: linesOf(text.imagery),
    avoid: linesOf(text.avoid),
})

const joined = (items: ReadonlyArray<string>, none: string) => (items.length === 0 ? none : items.join(", "))

/** Projects one brand proposal into its card: the palette, fonts, tone, address, imagery and what to avoid. */
export const brandCardOf = (
    proposal: BrandProposalType,
    say: BrandCardSay,
    state: BrandCardState,
): BrandProposalCardView => {
    const { kit } = proposal
    return {
        id: proposal.id,
        decidedLine: proposal.status === "proposed" ? "" : say.decidedLine(proposal.status, proposal.fileName),
        decidedLabel: say.status(proposal.status),
        decidedTone: proposal.status === "applied" ? "success" : "neutral",
        head: say.head(kit.brandName, proposal.fileName),
        waitingLabel: say.status("proposed"),
        colorsLabel: say.labels.colors,
        colors: kit.colors,
        items: [
            { id: "fonts", term: say.labels.fonts, description: joined(kit.fonts, say.none) },
            { id: "tone", term: say.labels.tone, description: kit.tone || say.none },
            { id: "address", term: say.labels.address, description: kit.address || say.none },
            { id: "imagery", term: say.labels.imagery, description: joined(kit.imagery, say.none) },
            { id: "avoid", term: say.labels.avoid, description: joined(kit.avoid, say.none) },
        ],
        isEditing: state.isEditing,
        fields: state.fields,
        labels: say.labels,
        colorsHint: say.colorsHint,
        error: state.error,
        isPending: state.isPending,
        confirmLabel: say.confirm,
        editLabel: state.isEditing ? say.closeEdit : say.edit,
        rejectLabel: say.reject,
    }
}
