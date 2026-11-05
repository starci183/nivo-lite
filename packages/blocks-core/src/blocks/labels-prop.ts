import { specText } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { ValueLabels } from "../rows/value-labels"
import { PATH_MAX } from "./bounds"

/** The most paths one block gives words to. */
export const LABEL_PATHS_MAX = 20

/** The most values one path gives words to. */
export const LABEL_VALUES_MAX = 50

/** The longest raw value a label stands for. */
export const LABEL_VALUE_MAX = 64

/** The zod type of the labels prop. */
export type LabelsSchema = z.ZodType<ValueLabels>

const valueWords = z
    .record(z.string().min(1).max(LABEL_VALUE_MAX), specText)
    .refine((words) => Object.keys(words).length <= LABEL_VALUES_MAX)

/**
 * The words of raw values, by path: `{ "stage": { "won": { "key": "stage_won" } } }` draws the value `won` at `stage` as those
 * words. A value with no words draws as it is. Bounded in paths, in values per path and in the length of a value.
 */
export const labelsProp: LabelsSchema = z
    .record(z.string().min(1).max(PATH_MAX), valueWords)
    .refine((labels) => Object.keys(labels).length <= LABEL_PATHS_MAX)
