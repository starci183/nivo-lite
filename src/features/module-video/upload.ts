"use client";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { uploadTicket } from "./actions";

/**
 * Upload files straight from the browser to the workspace's `media` bucket. A server action (owner/manager only) hands out one signed upload ticket per
 * file (the render lane's createMediaUpload: type and size are checked there); the bytes never pass through the app server.
 * Returns the bucket paths that went up and one plain message per file that did not.
 */
export const uploadMedia = async (files: ReadonlyArray<File>, onStart?: (name: string) => void): Promise<{ readonly paths: Array<string>; readonly errors: Array<{ name: string; error: string }> }> => {
  const paths: Array<string> = [];
  const errors: Array<{ name: string; error: string }> = [];
  const browser = supabaseBrowser();
  for (const file of files) {
    onStart?.(file.name);
    const ticket = await uploadTicket({ name: file.name, type: file.type, size: file.size });
    if (!ticket.ok) {
      errors.push({ name: file.name, error: ticket.error });
      continue;
    }
    const up = await browser.storage.from("media").uploadToSignedUrl(ticket.data.path, ticket.data.token, file, { contentType: file.type });
    if (up.error) errors.push({ name: file.name, error: up.error.message });
    else paths.push(ticket.data.path);
  }
  return { paths, errors };
};
