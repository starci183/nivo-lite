import "server-only";
import type { Connector } from "../data-hub";

/** Email over IMAP, read only: new messages of the chosen folders become hub messages. */
export const connector: Connector = {
  sync: async () => {
    throw new Error("Kết nối này đang được hoàn thiện.");
  },
};
