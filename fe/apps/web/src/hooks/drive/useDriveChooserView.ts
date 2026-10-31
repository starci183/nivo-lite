"use client"

import { useFormatter, useTranslations } from "next-intl"
import { isReadableDriveFile } from "./drive.shared"
import type { DriveFileRow } from "./drive.shared"
import { useDriveChoose } from "./useDriveChoose"
import type { DriveVisibility } from "./useDriveChoose"

/** The visibility a radio value stands for; a value that is not one keeps the safer, internal one. */
const visibilityOf = (value: string): DriveVisibility => (value === "public" ? "public" : "internal")

/**
 * The choose step of Google Drive in the words of the reader, for the page and the hub wizard alike: what the composite draws, and the
 * commands behind it. A file NIVO cannot read stays in the list, unticked, with the reason under its name.
 */
export const useDriveChooserView = () => {
    const t = useTranslations("driveConnection")
    const format = useFormatter()
    const choose = useDriveChoose(t("pickFailed"))
    const { listing, selected } = choose

    const sizeOf = (file: DriveFileRow): string =>
        file.sizeBytes === null ? "" : t("fileSize", { size: format.number(file.sizeBytes / (1024 * 1024), { maximumFractionDigits: 1 }) })
    const descriptionOf = (file: DriveFileRow): string => {
        if (!isReadableDriveFile(file)) return t("fileUnreadable")
        const modified =
            file.modifiedTime === null
                ? ""
                : t("fileModified", { date: format.dateTime(new Date(file.modifiedTime), { day: "2-digit", month: "2-digit" }) })
        return [file.path, sizeOf(file), modified].filter(Boolean).join(" · ")
    }

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
                              description: descriptionOf(file),
                              isDisabled: !isReadableDriveFile(file),
                          })),
                          selected,
                          notices: listing.truncated
                              ? [{ id: "truncated", tone: "cautionary" as const, title: t("truncated") }]
                              : [],
                          ...(listing.empty ? { empty: { message: t("pickedEmptyTitle"), description: t("pickedEmptyBody") } } : {}),
                          visibility: {
                              label: t("visibilityLabel"),
                              description: choose.visibility === "internal" ? t("visInternalHelp") : t("visPublicHelp"),
                              value: choose.visibility,
                              options: [
                                  { value: "internal", label: t("visInternal") },
                                  { value: "public", label: t("visPublic") },
                              ],
                          },
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
            changeVisibility: (value: string) => choose.setVisibility(visibilityOf(value)),
            add: choose.add,
        },
    }
}
