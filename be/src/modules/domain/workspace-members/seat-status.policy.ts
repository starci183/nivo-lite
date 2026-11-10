import type { MemberStatus, SeatNote, SeatStatusWrite } from "./workspace-members.contracts"

/** The longest note a person may leave when they switch a seat off. */
export const SEAT_NOTE_MAX = 500

/** The note as it is stored: trimmed and bounded, or null when there is none. */
const noteOf = (note: SeatNote): string | null => {
    const trimmed = (note ?? "").trim().slice(0, SEAT_NOTE_MAX)
    return trimmed === "" ? null : trimmed
}

/**
 * What a status change writes on a seat: switching it off records who did it, when (the database clock) and the note; switching it on
 * clears them. Either way it is a person's change, never the deletion of the workspace.
 */
export const seatStatusWrite = (status: MemberStatus, actorId: string, note: SeatNote): SeatStatusWrite =>
    status === "disabled"
        ? {
              status,
              disabledAt: () => "now()",
              disabledBy: actorId,
              disabledNote: noteOf(note),
              disabledByDeletion: false,
          }
        : { status, disabledAt: null, disabledBy: null, disabledNote: null, disabledByDeletion: false }
