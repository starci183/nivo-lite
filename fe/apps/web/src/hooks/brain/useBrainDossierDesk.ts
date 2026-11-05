"use client"

import { useState } from "react"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { usePaneCopy } from "@/hooks/paneFrame"
import { loadingSlot, mapSlot, useSlotLabels } from "@/hooks/slot"
import { useQueryKnowledgeSourcesSwr } from "@/hooks/swr"
import { brainGridOf, dossierDocumentsOf, dossierSectionsOf, findOpened, reviewedStatusOf } from "@/modules/brain"
import type { CategoryView, DossierDeskView, DossierSource, DossierView, Standing } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { brainDossierHref, brainTabHref } from "@/modules/routes"
import { useDossierAsideWords } from "./useDossierAsideWords"
import { useDossierDeskWords } from "./useDossierDeskWords"
import { useDossierOwner } from "./useDossierOwner"
import type { DossierOwner } from "./useDossierOwner"
import { useBrainDossiers } from "./useBrainDossiers"
import { useDossierReviewSummary } from "./useDossierReviewSummary"

/** No categories yet: the read has not answered, and the desk is waiting. */
const NO_CATEGORIES: ReadonlyArray<CategoryView> = []

/** No documents yet: the read has not answered. */
const NO_SOURCES: ReadonlyArray<DossierSource> = []

/** The commands of the desk. */
interface DossierDeskCommands {
    readonly setQuery: (value: string) => void
    readonly select: (id: string) => void
    readonly back: () => void
    readonly closeAside: () => void
    readonly retry: () => void
}

/** What the desk gives its block. */
interface DossierDesk {
    readonly view: DossierDeskView
    readonly on: DossierDeskCommands
    /** The id of the dossier the head and the side pane are about; null while nothing is open. */
    readonly openId: string | null
    /** Who owns the open dossier and the task that changes it. */
    readonly owner: DossierOwner
}

/** What the desk reads from the address. */
interface DossierDeskInput {
    /** The dossier the address opens. */
    readonly dossier: string | undefined
    /** The map keeps the list beside it: a row opens its node of the map and nothing opens by itself. */
    readonly mode: "list" | "map"
}

/**
 * The dossiers desk: the categories with their dossiers as one list (figures over the search over the rows), the dossier the
 * address opens (or the first one on a wide screen) with its head and the side pane that says what it lacks and what it holds.
 * The first reads (the categories, the members, the review summary) settle together, so every region draws its skeleton at once.
 */
export const useBrainDossierDesk = (input: DossierDeskInput): DossierDesk => {
    const w = useDossierDeskWords()
    const aw = useDossierAsideWords()
    const desk = w.words.desk
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const member = useWorkspaceMember()
    const slotLabels = useSlotLabels()
    const { categories, slot, reload } = useBrainDossiers()
    const summary = useDossierReviewSummary()
    const sources = useQueryKnowledgeSourcesSwr({})
    const [query, setQuery] = useState("")
    const [hiddenId, setHiddenId] = useState<string | null>(null)
    const all = categories ?? NO_CATEGORIES
    const standingOf = (dossier: DossierView): Standing =>
        reviewedStatusOf(dossier.status, summary.reviewOf(dossier.id))
    const sections = dossierSectionsOf(all, query, {
        captionOf: (category) =>
            category.order === null
                ? category.label
                : desk("sectionCaption", { order: String(category.order).padStart(2, "0"), label: category.label }),
        rowOf: (_category, dossier) =>
            w.rowOf(dossier, standingOf(dossier), summary.reviewOf(dossier.id)?.openCount ?? 0),
    })
    const waiting = member.isLoading || "isLoading" in slot || (!summary.isReady && !summary.isFailed)
    const listSlot = waiting ? loadingSlot<typeof sections>() : mapSlot(slot, () => sections)
    const isMap = input.mode === "map"
    const selectedId = waiting ? null : (input.dossier ?? (isMap ? null : (sections[0]?.rows[0]?.id ?? null)))
    const opened = findOpened(all, selectedId, standingOf)
    const owner = useDossierOwner({ dossier: opened === null ? null : opened.dossier, onSaved: reload })
    const details = opened === null ? [] : aw.detailsOf(owner, opened.dossier)
    const isAsideShown = opened !== null && hiddenId !== opened.dossier.id
    const isWhole = !waiting && !("items" in listSlot)
    const documents =
        opened === null ? [] : dossierDocumentsOf(sources.data ?? NO_SOURCES, opened.dossier.ref).map(w.documentOf)
    const view: DossierDeskView = {
        list: {
            slot: listSlot,
            slotLabels: { ...slotLabels(desk("emptyTitle")), error: pane.errorTitle },
            figures: w.figuresOf(all, standingOf, summary.activeCount),
            query,
            selectedId,
            isFiltered: query.trim() !== "" && sections.length === 0,
        },
        grid: brainGridOf({
            hasAside: waiting || isAsideShown,
            phone: input.dossier === undefined ? "list" : "main",
            isWhole,
        }),
        isWhole,
        head: aw.headViewOf(
            waiting,
            opened,
            opened === null ? undefined : summary.reviewOf(opened.dossier.id)?.openCount,
        ),
        aside: aw.asideViewOf({ waiting, opened, isAsideShown, canWrite: member.canWrite, documents, details }),
        isWaiting: waiting,
    }
    return {
        view,
        openId: opened === null ? null : opened.dossier.id,
        owner,
        on: {
            setQuery,
            select: (id) => {
                setHiddenId(null)
                router.push(isMap ? brainTabHref("map", { node: id }) : brainDossierHref(id))
            },
            back: () => router.push(brainTabHref(isMap ? "map" : "dossiers")),
            closeAside: () => setHiddenId(opened === null ? null : opened.dossier.id),
            retry: reload,
        },
    }
}
