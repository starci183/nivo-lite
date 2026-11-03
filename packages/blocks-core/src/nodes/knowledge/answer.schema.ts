import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"
import type { AnswerInput, AnswerOutput, AnswerParams, ClaimRule } from "./answer.types"

const QUESTION_MAX = 4000
const REPLY_MAX = 4000
const ID_MAX = 100
const PHRASE_MAX = 200
const PHRASES_MAX = 50
const RULES_MAX = 50
const EFFECTS_MAX = 100

const phrases: z.ZodArray<z.ZodString> = z.array(z.string().min(1).max(PHRASE_MAX)).max(PHRASES_MAX)

const claimRuleSchema: NodeSchema<ClaimRule> = z.object({
    id: z.string().min(1).max(ID_MAX),
    requires: z.string().min(1).max(ID_MAX),
    phrases: z.object({ vi: phrases, en: phrases }),
})

/** The params: the language of the neutral lines and the claim rules (null for the default ones). */
export const answerParamsSchema: NodeSchema<AnswerParams> = z.object({
    locale: z.enum(["vi", "en"]),
    claims: z.array(claimRuleSchema).max(RULES_MAX).nullable(),
})

/** The input: the question and the effects the turn recorded so far. */
export const answerInputSchema: NodeSchema<AnswerInput> = z.object({
    question: z.string().min(1).max(QUESTION_MAX),
    recordedEffects: z.array(z.string().max(ID_MAX)).max(EFFECTS_MAX),
})

/** The output: the reply and what the checks did to it. */
export const answerOutputSchema: NodeSchema<AnswerOutput> = z.object({
    reply: z.string().min(1).max(REPLY_MAX),
    grounded: z.boolean(),
    rewritten: z.boolean(),
    removedClaims: z.array(z.string().max(ID_MAX)).max(RULES_MAX),
    knowledgeGap: z.string().max(QUESTION_MAX).nullable(),
})
