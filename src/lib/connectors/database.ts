import "server-only";
import type { Connector } from "../data-hub";

/** Database (PostgreSQL, MySQL, SQL Server), read only: pull the mapped tables into the hub. */
export const connector: Connector = {
  sync: async () => {
    throw new Error("Kết nối này đang được hoàn thiện.");
  },
};
