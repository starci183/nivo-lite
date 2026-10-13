import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { currentTime, figuresOf, needsMaintenance } from "@/hooks/brain"
import type { FactPreset } from "@/hooks/brain"
import { isManagerRole } from "@/lib/members-shared"
import { getSession } from "@/lib/session"
import { readBrain, readKnowledgeSources } from "@/modules/db"
import { CONSOLE_ROUTES, KNOWLEDGE_ROUTES } from "@/modules/routes"
import type { BrainFact, BrainGap } from "@/modules/types"
import { BrainPageBase } from "./component"
import type { BrainPageBaseProps } from "./component"

/** The document title of the page. */
export const brainMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("brain")
    return { title: t("title") }
}

/** What the page reads from the address: the fact being written, a fact to give a new value, a question to answer. */
interface BrainPageProps {
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

type Translate = Awaited<ReturnType<typeof getTranslations<"brain">>>

/** The words of the page that do not depend on its data. */
const copyOf = (
    t: Translate,
): Pick<
    BrainPageBaseProps["props"],
    "crumbLabel" | "crumbHome" | "homeHref" | "eyebrow" | "title" | "description" | "documentsLabel" | "documentsHref"
> => ({
    crumbLabel: t("crumbLabel"),
    crumbHome: t("crumbHome"),
    homeHref: CONSOLE_ROUTES.dashboard,
    eyebrow: t("title"),
    title: t("title"),
    description: t("intro"),
    documentsLabel: t("knowledgeLink"),
    documentsHref: KNOWLEDGE_ROUTES.library,
})

/** The form, as the address asks for it: closed, a new fact, a new value for a fact in force, or the answer to a question. */
const formOf = (
    props: BrainPageProps,
    facts: ReadonlyArray<BrainFact>,
    gaps: ReadonlyArray<BrainGap>,
    businessName: string,
): Pick<BrainPageBaseProps["props"], "isFormOpen" | "formKey" | "editing" | "preset"> => {
    const editing = facts.find((fact) => fact.id === props.edit && fact.status === "active") ?? null
    const gap = gaps.find((one) => one.id === props.answer)
    if (editing !== null) return { isFormOpen: true, formKey: editing.id, editing, preset: undefined }
    if (gap !== undefined) {
        const preset: FactPreset = {
            subjectType: "business",
            subjectLabel: gap.topic ?? businessName,
            attributeLabel: gap.attributeGuess ?? "",
            scope: "public",
            gapId: gap.id,
            question: gap.question,
        }
        return { isFormOpen: true, formKey: gap.id, editing: null, preset }
    }
    return props.fact === undefined
        ? { isFormOpen: false, formKey: "closed", editing: null, preset: undefined }
        : { isFormOpen: true, formKey: "new", editing: null, preset: undefined }
}

/** The Second Brain page body: the shared memory of the business. Everyone reads; owners and managers decide. */
export const BrainPage = async (props: BrainPageProps) => {
    const [t, session] = await Promise.all([getTranslations("brain"), getSession()])
    const workspaceId = session.workspace.id
    const [brain, sources] = await Promise.all([readBrain(workspaceId), readKnowledgeSources(workspaceId)])
    if (brain.kind !== "ok") throw new Error(`brain: ${brain.kind} ${brain.code}`)
    if (sources.kind !== "ok") throw new Error(`brain: ${sources.kind} ${sources.code}`)
    const canWrite = isManagerRole(session.member.role)
    const nowMs = currentTime()
    const { facts, lessons, gaps, lenses, extractions, gapsOpen } = brain.value
    return (
        <BrainPageBase
            props={{
                ...copyOf(t),
                ...formOf(props, facts, gaps, session.workspace.name),
                workspaceId,
                canWrite,
                figures: figuresOf({ facts, lessons, documents: sources.value, extractions, gapsOpen }),
                facts,
                lessons,
                gaps,
                lenses,
                nowMs,
                isMaintenanceDue: canWrite && needsMaintenance(facts, nowMs),
                isLoading: false,
            }}
        />
    )
}

/** The same page while its data loads: labels stay, the figures and the lists are skeletons. */
export const BrainLoadingPage = async () => {
    const t = await getTranslations("brain")
    return (
        <BrainPageBase
            props={{
                ...copyOf(t),
                isFormOpen: false,
                formKey: "closed",
                editing: null,
                preset: undefined,
                workspaceId: "",
                canWrite: false,
                figures: figuresOf({ facts: [], lessons: [], documents: [], extractions: [], gapsOpen: 0 }),
                facts: [],
                lessons: [],
                gaps: [],
                lenses: [],
                nowMs: 0,
                isMaintenanceDue: false,
                isLoading: true,
            }}
        />
    )
}
