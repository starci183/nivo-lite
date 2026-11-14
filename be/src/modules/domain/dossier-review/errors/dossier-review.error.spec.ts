import { DOSSIER_REVIEW_ERROR_KINDS, DossierReviewErrorCode } from "./dossier-review.error"
import { DOSSIER_REVIEW_MESSAGES } from "../messages/dossier-review.messages"

describe("DossierReviewErrorCode", () => {
    it("names every code DOSSIER_REVIEW_<WHAT>, gives each a kind, and has a message in every language", () => {
        const codes = Object.values(DossierReviewErrorCode)
        expect(codes).toEqual([
            "DOSSIER_REVIEW_CRITIC_NOT_FOUND",
            "DOSSIER_REVIEW_CRITIC_DECIDED",
            "DOSSIER_REVIEW_CRITIC_ANSWER_INVALID",
            "DOSSIER_REVIEW_CRITIC_RUNNING",
        ])
        expect(Object.keys(DOSSIER_REVIEW_ERROR_KINDS).sort()).toEqual([...codes].sort())
        for (const language of Object.values(DOSSIER_REVIEW_MESSAGES)) {
            for (const code of codes) expect(Object.keys(language)).toContain(`errors.${code}`)
        }
    })
})
