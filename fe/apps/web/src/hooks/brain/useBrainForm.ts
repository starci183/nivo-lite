import { useBrainBoard } from "./useBrainBoard"
import { useWorkspaceMember } from "@/hooks/knowledge"
import type { FactPreset } from "@/modules/brain"
import type { BrainFact, BrainLens } from "@/modules/types"

/** What the address asks of the fact form: the fact being written, a fact to give a new value, a question to answer. */
interface BrainFormAddress {
    readonly fact: string | undefined
    readonly edit: string | undefined
    readonly answer: string | undefined
}

/** The form, as the address asks for it. */
interface BrainFormState {
    /** The member may write; others see no form. */
    readonly canWrite: boolean
    readonly isOpen: boolean
    /** Changes whenever the form is opened for something else, so the form starts afresh. */
    readonly formKey: string
    readonly editing: BrainFact | null
    readonly preset: FactPreset | undefined
    readonly lenses: ReadonlyArray<BrainLens>
}

/** The fact form, as the address asks for it: closed, a new fact, a new value for a fact in force, or the answer to a question. */
export const useBrainForm = (address: BrainFormAddress): BrainFormState => {
    const board = useBrainBoard()
    const member = useWorkspaceMember()
    const editing = board.facts.find((fact) => fact.id === address.edit && fact.status === "active") ?? null
    const gap = board.gaps.find((one) => one.id === address.answer)
    const base = { canWrite: board.canWrite, lenses: board.lenses }
    if (editing !== null) return { ...base, isOpen: true, formKey: editing.id, editing, preset: undefined }
    if (gap !== undefined) {
        const preset: FactPreset = {
            subjectType: "business",
            subjectLabel: gap.topic ?? member.workspaceName,
            attributeLabel: gap.attributeGuess ?? "",
            scope: "public",
            gapId: gap.id,
            question: gap.question,
        }
        return { ...base, isOpen: true, formKey: gap.id, editing: null, preset }
    }
    return address.fact === undefined
        ? { ...base, isOpen: false, formKey: "closed", editing: null, preset: undefined }
        : { ...base, isOpen: true, formKey: "new", editing: null, preset: undefined }
}
