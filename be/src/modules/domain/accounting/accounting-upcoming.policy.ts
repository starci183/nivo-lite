import type { SupplierPayableRow } from "@modules/domain/supplier-payables"
import type { TaxProfile, UpcomingDue } from "./accounting-desk.contracts"
import { HORIZON_DAYS, upcomingDues } from "./tax-calendar.policy"

/**
 * The dues of the next days that the workbench draws: the tax deadlines of the profile and the open supplier invoices, from the
 * stored rows only. Null when the Brain holds no tax profile, because the deadlines cannot be known without it.
 */
export const upcomingOf = (
    profile: TaxProfile | null,
    payables: ReadonlyArray<SupplierPayableRow>,
    today: string,
): ReadonlyArray<UpcomingDue> | null =>
    profile === null
        ? null
        : upcomingDues(
              profile,
              payables
                  .filter((payable) => payable.status === "open")
                  .map((payable) => ({
                      supplier: payable.supplier,
                      invoiceNo: payable.invoiceNo,
                      amountVnd: payable.amountVnd,
                      dueOn: payable.dueOn,
                  })),
              today,
              HORIZON_DAYS,
          )
