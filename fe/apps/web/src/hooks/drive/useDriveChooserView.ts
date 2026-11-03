"use client"

import { useFormatter, useTranslations } from "next-intl"
import { driveFileNoteOf, isReadableDriveFile } from "./drive.shared"
import { useDriveChoose } from "./useDriveChoose"
import type { Dispatch, SetStateAction } from "react"

/** The view `useDriveChooserView` returns. */
export interface DriveChooserView {
    added: number
    props: {
        listing?: {
            add: {
                label: string
                isPending: boolean
                isDisabled: boolean
            }
            empty?: {
                message: string
                description: string
            }
            title: string
            count: string
            filesLabel: string
            files: {
                value: string
                label: string
                description: string
                isDisabled: boolean
            }[]
            selected: readonly string[]
            notices: {
                id: string
                tone: "cautionary"
                title: string
            }[]
        }
        error: string
        added: string
        pickLabel?: string
        link: {
            label: string
            placeholder: string
            description: string
            value: string
            readLabel: string
            isReading: boolean
        }
    }
    on: {
        changeLink: Dispatch<SetStateAction<string>>
        read: () => undefined
        pick: () => undefined
        select: Dispatch<SetStateAction<readonly string[]>>
        add: () => undefined
    }
}

/**
 * The choose step of Google Drive in the words of the reader, for the page and the hub wizard alike: what the composite draws, and the
 * commands behind it. A file NIVO cannot read stays in the list, unticked, with the reason under its name.
 */
export const useDriveChooserView = (): DriveChooserView => {
    const t = useTranslations("driveConnection")
    const format = useFormatter()
    const choose = useDriveChoose(t("pickFailed"))
    const { listing, selected } = choose

    const ticked = listing === null ? 0 : listing.files.filter((file) => selected.includes(file.id)).length
    return {
        added: choose.added,
        props: {
            link: {
                label: t("linkLabel"),
                placeholder: t("linkPlaceholder"),
                description: t("linkHelp"),
                value: choose.link,
                readLabel: t("linkRead"),
                isReading: choose.isReading,
            },
            ...(choose.hasPicker ? { pickLabel: t("pick") } : {}),
            error: choose.error,
            added: choose.added === 0 ? "" : t("addedBody", { count: choose.added }),
            ...(listing === null
                ? {}
                : {
                      listing: {
                          title: listing.name === "" ? t("pickedFiles") : listing.name,
                          count: t("listingCount", { total: listing.files.length, ticked }),
                          filesLabel: t("filesLabel"),
                          files: listing.files.map((file) => ({
                              value: file.id,
                              label: file.name,
                              description: driveFileNoteOf(t, format, file),
                              isDisabled: !isReadableDriveFile(file),
                          })),
                          selected,
                          notices: listing.truncated
                              ? [{ id: "truncated", tone: "cautionary" as const, title: t("truncated") }]
                              : [],
                          ...(listing.empty
                              ? { empty: { message: t("pickedEmptyTitle"), description: t("pickedEmptyBody") } }
                              : {}),
                          add: {
                              label: t("add", { count: ticked }),
                              isPending: choose.isAdding,
                              isDisabled: ticked === 0,
                          },
                      },
                  }),
        },
        on: {
            changeLink: choose.setLink,
            read: () => void choose.readFolder(),
            pick: choose.pick,
            select: choose.setSelected,
            add: choose.add,
        },
    }
}
