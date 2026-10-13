import type { JobRecord, OfferTerms, TextOf } from "../hiring.contracts"
import { findFairnessViolations } from "./fairness.policy"

/** The most characters a generated greeting or closing may have. */
const PART_MAX = 700
const PART_MIN = 15

/** The pay of a job as one phrase, by the text catalog. */
export const payPhrase = (
    job: Pick<JobRecord, "payMinVnd" | "payMaxVnd" | "payUnit">,
    textOf: TextOf,
    format: (amount: number) => string,
): string => {
    const unit = textOf(`hiring.payUnit.${job.payUnit}`, {})
    const { payMinVnd: min, payMaxVnd: max } = job
    if (min !== null && max !== null && min > 0 && max > 0) {
        return min === max
            ? textOf("hiring.pay.exact", { amount: format(min), unit })
            : textOf("hiring.pay.range", { min: format(min), max: format(max), unit })
    }
    if (min !== null && min > 0) return textOf("hiring.pay.from", { amount: format(min), unit })
    if (max !== null && max > 0) return textOf("hiring.pay.upTo", { amount: format(max), unit })
    return textOf("hiring.pay.negotiable", {})
}

/** The terms of an offer as plain lines, always written by code from what the owner entered and never by a model. */
export const termsBlock = (job: JobRecord, terms: OfferTerms, offerDays: number, pay: string, textOf: TextOf): string =>
    [
        textOf("hiring.offer.termsHead", {}),
        textOf("hiring.offer.termPosition", {
            title: terms.title === "" ? job.title : terms.title,
            employment: textOf(`hiring.employment.${job.employmentType}`, {}),
        }),
        textOf("hiring.offer.termPay", { pay: terms.pay === "" ? pay : terms.pay }),
        terms.startDate === "" ? "" : textOf("hiring.offer.termStart", { date: terms.startDate }),
        terms.probation === "" ? "" : textOf("hiring.offer.termProbation", { probation: terms.probation }),
        job.location === "" ? "" : textOf("hiring.offer.termPlace", { place: job.location }),
        terms.note === "" ? "" : textOf("hiring.offer.termNote", { note: terms.note }),
        textOf("hiring.offer.termValid", { days: offerDays }),
    ]
        .filter((line) => line !== "")
        .join("\n")

/** What the offer letter is made of. */
export interface OfferLetterParts {
    /** The name of the candidate, for the template greeting. */
    readonly candidate: string
    /** The name of the business, for the template greeting and the signature. */
    readonly shop: string
    /** The position offered, for the template greeting. */
    readonly title: string
    /** The terms block written by code. */
    readonly terms: string
    /** The greeting the model wrote, or null to use the template. */
    readonly opening: string | null
    /** The closing the model wrote, or null to use the template. */
    readonly closing: string | null
}

/** The letter: the model greeting and closing when both came out clean, a fixed template otherwise, the terms always in the middle. */
export const composeOffer = (parts: OfferLetterParts, textOf: TextOf): string =>
    [
        parts.opening ??
            textOf("hiring.offer.opening", { name: parts.candidate, shop: parts.shop, title: parts.title }),
        parts.terms,
        parts.closing ?? textOf("hiring.offer.closing", {}),
        textOf("hiring.offer.signoff", { shop: parts.shop }),
    ].join("\n\n")

/** A model paragraph for the letter when it is plain words: no markdown, no figures, nothing about protected traits, a sensible length; null otherwise. */
export const cleanLetterPart = (value: string): string | null => {
    const text = value.replace(/\*\*?|__|#+ /gu, "").trim()
    const plain = text.length >= PART_MIN && text.length <= PART_MAX && !/\d/u.test(text)
    return plain && findFairnessViolations(text).length === 0 ? text : null
}
