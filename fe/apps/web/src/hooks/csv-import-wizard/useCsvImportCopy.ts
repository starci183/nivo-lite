"use client"

import { useTranslations } from "next-intl"
import { CSV_SOURCES, SCHEDULES, TABLE_ENTITIES, type CsvSource } from "./csv-import-wizard.shared"

/** The catalog keys of each source (title, body). */
const SOURCE_KEYS = {
    file: ["sourceFile", "sourceFileBody"],
    sheet: ["sourceSheet", "sourceSheetBody"],
    manual: ["sourceManual", "sourceManualBody"],
    document: ["sourceDocument", "sourceDocumentBody"],
} as const

/** The catalog key of each kind of rows. */
const ENTITY_KEYS = {
    customer: "entityCustomer",
    order: "entityOrder",
    product: "entityProduct",
    transaction: "entityTransaction",
    other: "entityOther",
} as const

/** The catalog key of each refresh schedule, by its minutes (null is manual). */
const scheduleKeyOf = (minutes: number | null) => {
    if (minutes === 60) return "schedule60"
    if (minutes === 360) return "schedule360"
    if (minutes === 1440) return "schedule1440"
    return "scheduleManual"
}

/** The view `useCsvImportCopy` returns. */
export interface CsvImportCopyView {
    steps: {
        source: string
        data: string
        docs: string
        map: string
        import: string
        agent: string
    }
    entities: {
        id: "other" | "transaction" | "customer" | "order" | "product"
        label: string
    }[]
    sources: {
        value: CsvSource
        label: string
        description: string
    }[]
    schedules: {
        id: string
        label: string
    }[]
    kinds: {
        phone: string
        email: string
        number: string
        date: string
    }
    text: {
        back: string
        next: string
        close: string
        done: string
        fieldName: string
        fieldNameHint: string
        fieldEntity: string
        fieldSource: string
        fileLabel: string
        filePrompt: string
        linkSheetLabel: string
        linkSheetHint: string
        linkSheetPlaceholder: string
        pasteLabel: string
        pasteHint: string
        pasteUse: string
        docsLabel: string
        docsPrompt: string
        docsNote: string
        docsOr: string
        linkDocLabel: string
        linkDocHint: string
        linkDocPlaceholder: string
        importScheduleLabel: string
        gridTitle: string
        gridAddRow: string
        gridAddColumn: string
        gridRemove: string
        gridTooBig: string
        sheetLabel: string
        mapId: string
        mapTitle: string
        mapDate: string
        mapIdHint: string
        previewLabel: string
        previewEmpty: string
    }
    /** The plural label of a kind of rows, as the import intro names it. */
    entityLabel: (entity: keyof typeof ENTITY_KEYS) => string
}

/** The fixed copy of the import wizard (`connectorCsv`): step names, choices and every plain label. */
export const useCsvImportCopy = (): CsvImportCopyView => {
    const t = useTranslations("connectorCsv")
    return {
        steps: {
            source: t("stepSource"),
            data: t("stepData"),
            docs: t("stepDocs"),
            map: t("stepMap"),
            import: t("stepImport"),
            agent: t("stepAgent"),
        },
        entities: TABLE_ENTITIES.map((entity) => ({ id: entity, label: t(ENTITY_KEYS[entity]) })),
        sources: CSV_SOURCES.map((source) => ({
            value: source,
            label: t(SOURCE_KEYS[source][0]),
            description: t(SOURCE_KEYS[source][1]),
        })),
        schedules: SCHEDULES.map((minutes) => ({
            id: minutes === null ? "" : String(minutes),
            label: t(scheduleKeyOf(minutes)),
        })),
        kinds: { phone: t("kindPhone"), email: t("kindEmail"), number: t("kindNumber"), date: t("kindDate") },
        text: {
            back: t("back"),
            next: t("next"),
            close: t("close"),
            done: t("done"),
            fieldName: t("fieldName"),
            fieldNameHint: t("fieldNameHint"),
            fieldEntity: t("fieldEntity"),
            fieldSource: t("fieldSource"),
            fileLabel: t("fileLabel"),
            filePrompt: t("filePrompt"),
            linkSheetLabel: t("linkSheetLabel"),
            linkSheetHint: t("linkSheetHint"),
            linkSheetPlaceholder: t("linkSheetPlaceholder"),
            pasteLabel: t("pasteLabel"),
            pasteHint: t("pasteHint"),
            pasteUse: t("pasteUse"),
            docsLabel: t("docsLabel"),
            docsPrompt: t("docsPrompt"),
            docsNote: t("docsNote"),
            docsOr: t("docsOr"),
            linkDocLabel: t("linkDocLabel"),
            linkDocHint: t("linkDocHint"),
            linkDocPlaceholder: t("linkDocPlaceholder"),
            importScheduleLabel: t("importScheduleLabel"),
            gridTitle: t("gridTitle"),
            gridAddRow: t("gridAddRow"),
            gridAddColumn: t("gridAddColumn"),
            gridRemove: t("gridRemove"),
            gridTooBig: t("gridTooBig"),
            sheetLabel: t("sheetLabel"),
            mapId: t("mapId"),
            mapTitle: t("mapTitle"),
            mapDate: t("mapDate"),
            mapIdHint: t("mapIdHint"),
            previewLabel: t("previewLabel"),
            previewEmpty: t("previewEmpty"),
        },
        /** The plural label of a kind of rows, as the import intro names it. */
        entityLabel: (entity: keyof typeof ENTITY_KEYS) => t(ENTITY_KEYS[entity]),
    }
}
