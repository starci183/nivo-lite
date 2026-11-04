import { isRecord } from "@modules/platform/primitives"
import type { ParameterValue, ParameterValueMap } from "../agent-templates.contracts"

/** The values of the buyer as the domain reads them: numbers, texts and yes or no, nothing else. */
export const valuesOf = (value: unknown): ParameterValueMap =>
    isRecord(value)
        ? Object.fromEntries(
              Object.entries(value).flatMap(([key, member]): Array<[string, ParameterValue]> =>
                  typeof member === "number" || typeof member === "string" || typeof member === "boolean"
                      ? [[key, member]]
                      : [],
              ),
          )
        : {}
