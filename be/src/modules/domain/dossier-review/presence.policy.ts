import { foldText } from "./document-state.policy"
import type {
    DocumentInput,
    DossierInputs,
    Expectation,
    FindingCandidate,
    ReviewContext,
} from "./dossier-inputs.contracts"
import { currentHolders, holdingsOf } from "./roles.policy"
import type { Holding } from "./roles.policy"
import {
    candidateOf,
    datesOf,
    documentsIn,
    dossierLabel,
    expectedEvidence,
    factEvidence,
    factsOfContext,
    hasAnyWord,
    remedyActionOf,
    titlesOf,
} from "./rule-kit.policy"
import type { RuleFamily } from "./rule-kit.policy"

/** Whether a document meets an expectation: its title carries one of the title words or a passage one of the text words. */
export const meets = (doc: DocumentInput, expectation: Expectation): boolean =>
    hasAnyWord(foldText(doc.title), expectation.titleAny) ||
    doc.passages.some((passage) => hasAnyWord(foldText(passage.text), expectation.textAny))

/** The documents of a dossier that meet an expectation. */
export interface MeetingDocuments {
    /** Among the actual ones. */
    readonly actual: ReadonlyArray<DocumentInput>
    /** Among the drafts. */
    readonly drafts: ReadonlyArray<DocumentInput>
}

/** The documents of a dossier that meet an expectation, among the actual ones and among the drafts. */
export const meetingDocuments = (inputs: DossierInputs, expectation: Expectation): MeetingDocuments => ({
    actual: documentsIn(inputs, ["actual"]).filter((doc) => meets(doc, expectation)),
    drafts: documentsIn(inputs, ["draft"]).filter((doc) => meets(doc, expectation)),
})

const names = (doc: DocumentInput, holder: Holding): boolean =>
    [doc.title, ...doc.passages.map((passage) => passage.text)].some((text) => foldText(text).includes(holder.key))

const holderGaps = (
    context: ReviewContext,
    inputs: DossierInputs,
    expectation: Expectation,
    holders: ReadonlyArray<Holding>,
): ReadonlyArray<FindingCandidate> => {
    const found = meetingDocuments(inputs, expectation)
    const candidates = expectation.signed ? found.actual : [...found.actual, ...found.drafts]
    const titles = titlesOf(context)
    return holders
        .filter((holder) => !candidates.some((doc) => names(doc, holder)))
        .map((holder) =>
            candidateOf(inputs, {
                ruleKey: "presence.expected",
                subject: `${expectation.key}:${holder.key}`,
                kind: "missing",
                severity: expectation.severity,
                code: "presence_expected_holder",
                params: { dossier: dossierLabel(inputs), expectation: expectation.label, holder: holder.name },
                evidence: [expectedEvidence(expectation.label), factEvidence(holder.fact, "context", titles)],
                remedyAction: remedyActionOf(inputs, "upload"),
            }),
        )
}

const expectationGaps = (context: ReviewContext, inputs: DossierInputs): ReadonlyArray<FindingCandidate> =>
    (inputs.entry?.expects ?? []).flatMap((expectation) => {
        const holders =
            expectation.about === null
                ? []
                : currentHolders(
                      holdingsOf(factsOfContext(context), expectation.about, datesOf(context)),
                      context.today,
                  )
        if (holders.length > 0) return holderGaps(context, inputs, expectation, holders)
        const found = meetingDocuments(inputs, expectation)
        if (found.actual.length > 0 || found.drafts.length > 0) return []
        return [
            candidateOf(inputs, {
                ruleKey: "presence.expected",
                subject: expectation.key,
                kind: "missing",
                severity: expectation.severity,
                code: "presence_expected",
                params: { dossier: dossierLabel(inputs), expectation: expectation.label },
                evidence: [expectedEvidence(expectation.label)],
                remedyAction: remedyActionOf(inputs, "upload"),
            }),
        ]
    })

const dossierGap = (inputs: DossierInputs): ReadonlyArray<FindingCandidate> =>
    inputs.entry?.requirement === "required"
        ? [
              candidateOf(inputs, {
                  ruleKey: "presence.dossier",
                  subject: "documents",
                  kind: "missing",
                  severity: "high",
                  code: "presence_dossier",
                  params: { dossier: dossierLabel(inputs) },
                  evidence: [expectedEvidence(inputs.dossier.name)],
                  remedyAction: remedyActionOf(inputs, "upload"),
              }),
          ]
        : []

/**
 * presence.expected: each expectation of a dossier that holds a document is met by a document whose title or passages carry its words
 * (one that must be signed by an actual one; an unsigned draft is the signature rule's), and one about a role names each current holder;
 * presence.dossier: a required dossier with neither an actual document nor a draft.
 */
export const presenceRules: RuleFamily = (context) =>
    context.dossiers.flatMap((inputs) =>
        documentsIn(inputs, ["actual", "draft"]).length === 0 ? dossierGap(inputs) : expectationGaps(context, inputs),
    )
