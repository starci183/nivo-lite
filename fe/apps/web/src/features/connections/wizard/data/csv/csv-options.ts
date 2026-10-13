import { TABLE_ENTITIES } from "@/hooks/csv-import-wizard"
import type { CsvEntity, CsvSource } from "@/hooks/csv-import-wizard"

/** The steps of the import wizard. */
export type Step = "source" | "data" | "docs" | "map" | "import" | "agent"
/** A line of feedback under the wizard step. */
export type Note = { readonly tone: "affirmative" | "negative" | "informative"; readonly text: string }

/** The steps of a table import, in order. */
export const TABLE_STEPS: ReadonlyArray<Step> = ["source", "data", "map", "import", "agent"]
/** The steps of a documents import, in order. */
export const DOC_STEPS: ReadonlyArray<Step> = ["source", "docs", "import", "agent"]
/** The sources an import can read, in the order they are offered. */
export const SOURCES: ReadonlyArray<CsvSource> = ["file", "sheet", "manual", "document"]
/** The catalog key of the starter columns of the typed grid for each kind of rows (column names joined by a bar). */
export const STARTER_KEY = {
    customer: "starterCustomer",
    order: "starterOrder",
    product: "starterProduct",
    transaction: "starterTransaction",
    other: "starterOther",
} as const

/** The starter columns of a kind of rows from its catalog line. */
export const starterColumns = (line: string): ReadonlyArray<string> => line.split("|")

/** A kind of table rows from a select value; customers when unknown. */
export const entityOf = (value: string): Exclude<CsvEntity, "document"> =>
    TABLE_ENTITIES.find((e) => e === value) ?? "customer"

/** The catalog keys of each source (title, body). */
export const SOURCE_KEY = {
    file: ["sourceFile", "sourceFileBody"],
    sheet: ["sourceSheet", "sourceSheetBody"],
    manual: ["sourceManual", "sourceManualBody"],
    document: ["sourceDocument", "sourceDocumentBody"],
} as const
/** The catalog key of each kind of rows. */
export const ENTITY_KEY = {
    customer: "entityCustomer",
    order: "entityOrder",
    product: "entityProduct",
    transaction: "entityTransaction",
    other: "entityOther",
} as const
/** The catalog key of each refresh schedule. */
export const SCHEDULE_KEY = { "": "scheduleManual", "60": "schedule60", "360": "schedule360", "1440": "schedule1440" } as const

