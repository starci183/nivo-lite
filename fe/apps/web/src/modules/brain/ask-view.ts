import type { useTranslations } from "next-intl"
import { isAgentModule } from "@/modules/documents"
import type { RetrievedPassage } from "@/modules/documents"
import { knowledgeSourceHref, workspaceHref } from "@/modules/routes"
import type { AskAgentOption, AskPassageView, AskSeesView, PaneGridLayout } from "@/modules/types"
import { LENS_LANES } from "./lenses"
import type { AgentLens } from "./lenses"

type KnowledgeTranslate = ReturnType<typeof useTranslations<"knowledge">>
type BrainTranslate = ReturnType<typeof useTranslations<"secondBrain">>

/** The panes of the try-it screen: the question beside what the agent sees, which runs both rows with its own head inside; a phone shows the question. */
export const askGridOf = (): PaneGridLayout => ({
    areas: {
        base: ["head", "main"],
        medium: ["head", "main"],
        wide: ["head aside", "main aside"],
    },
    columns: { base: ["fill"], medium: ["fill"], wide: ["fill", "standard"] },
    rows: { base: ["auto", "fill"], medium: ["auto", "fill"], wide: ["auto", "fill"] },
})

/** What the agent reads and for whom, as one option of the picker: its name and the kind of agent it is. */
export const askAgentOptionOf = (t: KnowledgeTranslate, lens: AgentLens): AskAgentOption => {
    const name = lens.name ?? ""
    const kind = lens.module !== null && isAgentModule(lens.module) ? t(`module_${lens.module}`) : ""
    // An agent named after its kind reads once, not "Accounting · Accounting".
    const parts = kind.toLocaleLowerCase() === name.toLocaleLowerCase() ? [name] : [name, kind]
    return { id: lens.id, label: parts.filter(Boolean).join(" · ") }
}

/** Where a passage was read from: the document and the place in it, a confirmed fact, or the base knowledge of NIVO. */
const citationOf = (t: KnowledgeTranslate, passage: RetrievedPassage): string => {
    if (passage.layer === "fact") return t("citeFact")
    return passage.position === null
        ? t("citeBase")
        : t("citeDocument", { title: passage.title, position: passage.position })
}

const VISIBILITY_KEY = { public: "vis_public", internal: "vis_internal", restricted: "vis_restricted" } as const

/** One passage the agent would read: its words, its citation (the document and the place in it) and who may read it. */
export const askPassageOf = (
    t: KnowledgeTranslate,
    passage: RetrievedPassage,
    workspaceId: string,
): AskPassageView => ({
    id: passage.key,
    text: passage.content,
    citation: citationOf(t, passage),
    href: passage.sourceId === null ? null : workspaceHref(workspaceId, knowledgeSourceHref(passage.sourceId)),
    chips: [
        { label: t(VISIBILITY_KEY[passage.visibility]), tone: "neutral" },
    ],
})

/** The comparison of the side pane: what the customer and the chosen agent each read of every kind of knowledge. */
export const askSeesOf = (
    lenses: ReadonlyArray<AgentLens>,
    agent: AgentLens | undefined,
    t: BrainTranslate,
): AskSeesView => {
    const shown = lenses.filter((lens) => lens.kind === "customer" || lens.id === agent?.id)
    return {
        audiences: shown.map((lens) => ({
            id: lens.id,
            name: lens.kind === "customer" ? t("audienceCustomer") : (lens.name ?? ""),
        })),
        lanes: LENS_LANES.map((lane) => ({
            id: lane,
            label: t(`lane_${lane}`),
            cells: Object.fromEntries(
                shown.flatMap((lens) => {
                    const cell = lens.cells.find((one) => one.lane === lane)
                    return cell === undefined ? [] : [[lens.id, { isOpen: cell.isOpen, count: cell.count }] as const]
                }),
            ),
        })),
    }
}
