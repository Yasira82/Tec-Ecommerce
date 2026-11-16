/**
 * Copy a link and tell the person what happened — "copied" only when it was, in their
 * language. `say` is `alert` in the app; a parameter so a test can read it.
 */
export async function copyLink(
  text: string,
  msgs: { linkCopied: string; linkCopyFailed: string },
  say: (m: string) => void = (m) => window.alert(m),
): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
    await navigator.clipboard.writeText(text);
    say(msgs.linkCopied);
    return true;
  } catch {
    say(msgs.linkCopyFailed);
    return false;
  }
}
