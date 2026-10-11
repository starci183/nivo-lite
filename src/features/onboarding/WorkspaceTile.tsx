"use client";

import { Avatar, type AvatarSize } from "@starci/grammar/common";

/**
 * The workspace's mark: Grammar's Avatar with the initials of its name and the name as its accessible name.
 * The previous hand-picked hex palette is gone; the mark takes the theme's neutral avatar pair (tone presentation, no raw colour).
 */
export const WorkspaceTile = ({ name, size = "lg" }: { readonly name: string; readonly size?: AvatarSize }) => <Avatar name={name} size={size} />;
