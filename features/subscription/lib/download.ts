/**
 * Hand the browser a file to save - the billing breakdown's CSV. Browser-only (the one helper in
 * `lib/` that touches the DOM), kept here so the hook stays free of Blob plumbing and a test can
 * replace it whole.
 *
 * The byte-order mark is what makes Excel read the file as UTF-8: without it a company named in
 * Chinese - common on a Hong Kong account - opens as mojibake.
 */
export function saveTextFile(
  filename: string,
  text: string,
  type = "text/csv;charset=utf-8",
): void {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // After the click has been handled: revoking first cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
