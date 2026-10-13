import { useFormatter } from "next-intl"

/** The number and date forms of the inventory screens, in the reader language. */
export interface InventoryFormat {
    /** A quantity with up to three decimals. */
    readonly qty: (value: number) => string
    /** An amount in dong. */
    readonly money: (value: number) => string
    /** A calendar day. */
    readonly day: (iso: string | null) => string
    /** A day with the time. */
    readonly stamp: (iso: string) => string
}

const QTY_DECIMALS = 3

/** The formatters of the inventory screens. */
export const useInventoryFormat = (): InventoryFormat => {
    const format = useFormatter()
    return {
        qty: (value) => format.number(value, { maximumFractionDigits: QTY_DECIMALS }),
        money: (value) =>
            format.number(Math.round(value), { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
        day: (iso) => (iso === null ? "-" : format.dateTime(new Date(iso), { dateStyle: "short" })),
        stamp: (iso) => format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" }),
    }
}
