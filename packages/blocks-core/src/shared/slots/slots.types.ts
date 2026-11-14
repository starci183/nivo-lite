/** The mark a slot carries while it is being read again; absent when the slot says nothing about it. */
export interface ValidatingMark {
    /** True while the slot is read again behind the items it already holds. */
    readonly isValidating?: boolean
}
