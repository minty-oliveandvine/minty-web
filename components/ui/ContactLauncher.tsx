"use client";

/**
 * The Minty cat at the bottom right of every page, and its "Talk to Minty" chat - drawn by
 * `@minty/shared/contact` (v0.14, owner 2026-11-05), in the sidebar's look. This app hands it its
 * Flask call (`POST /api/me/contact`, which mails the team with the person as Reply-To) and its
 * toast. A page can add its own line to the cat's pop-up with `useContactActions` (none does since
 * 2026-11-11, when the entity list's "Create company" went back to its floating "+").
 */

import {
  ContactLauncher as SharedContactLauncher,
  type ContactMessage,
  type ContactReceipt,
} from "@minty/shared/contact";

import "@/components/ui/sidebarHost";
import { useToast } from "@/components/ui/Toast";
import { mintyFetch } from "@/lib/apiClient";

const send = (message: ContactMessage) =>
  mintyFetch<ContactReceipt>("/api/me/contact", { method: "POST", json: message });

export function ContactLauncher() {
  const { showToast } = useToast();
  return <SharedContactLauncher send={send} notify={showToast} />;
}
