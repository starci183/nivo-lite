import type { Seg, ShiftStaff } from "../shifts.contracts"

/** A person who can take a coverage piece, including the resulting work and incremental cost. */
export interface Candidate {
    /** Person receiving the piece. */
    readonly staff: ShiftStaff
    /** Work after adding the piece. */
    readonly next: Array<Seg>
    /** Incremental labor cost. */
    readonly cost: number
    /** Minutes already assigned. */
    readonly minutes: number
}

/** One reassignment that frees a person to take a coverage candidate. */
export interface TransferPiece {
    /** Person whose existing piece must move. */
    readonly person: ShiftStaff
    /** Existing work to give to another eligible person. */
    readonly piece: Seg
    /** Candidate work installed after the transfer succeeds. */
    readonly takes: Candidate
}
