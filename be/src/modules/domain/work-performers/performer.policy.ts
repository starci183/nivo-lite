import type { ProposalFieldValue } from "@modules/domain/work-items"

/** The stages of a lead the sales AI may move it to. */
const LEAD_STAGES: ReadonlyArray<string> = ["new", "qualified", "proposal", "won", "lost"]

/** The text of a proposal field; an empty text when the field is missing. */
export const textOf = (value: ProposalFieldValue | undefined): string =>
    value === undefined || value === null ? "" : String(value)

/** The number in a proposal field, or null when the field holds none. */
export const numberOf = (value: ProposalFieldValue | undefined): number | null =>
    typeof value === "number" ? value : null

/** Where the owner finds a customer. */
export const leadHref = (leadId: string | null | undefined): string =>
    leadId === undefined || leadId === null ? "/chat" : `/leads/${leadId}`

/** The stage a text names, or null when it is not a stage. */
export const stageOf = (raw: string): string | null => (LEAD_STAGES.includes(raw) ? raw : null)

/** The non-empty parts joined with a middle dot. */
export const dotted = (parts: ReadonlyArray<string | null | undefined>): string =>
    parts.filter((part): part is string => part !== undefined && part !== null && part !== "").join(" · ")

/** The history lines a classification prompt reads: the summary with the first 400 characters of its evidence. */
export const historyLine = (summary: string, evidence: string | null): string =>
    evidence === null || evidence === "" ? summary : `${summary}: ${evidence.slice(0, 400)}`

/** The first of the texts that is not empty; an empty text when all are. */
export const firstText = (texts: ReadonlyArray<string>): string => texts.find((text) => text !== "") ?? ""
