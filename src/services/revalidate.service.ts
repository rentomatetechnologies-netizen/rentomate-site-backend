import { config } from "../config";

/** Same as revalidateWebsite, but waits for the answer (for scripts that exit right after). True when the website confirmed. */
export async function revalidateWebsiteNow(): Promise<boolean> {
  if (!config.revalidateUrl || !config.revalidateSecret) return false;
  try {
    const res = await fetch(config.revalidateUrl, {
      method: "POST",
      headers: { "x-revalidate-secret": config.revalidateSecret },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Tells the website to refresh its blog pages and homepage. Runs in the background; failures are only logged. */
export function revalidateWebsite() {
  if (!config.revalidateUrl || !config.revalidateSecret) return;
  fetch(config.revalidateUrl, {
    method: "POST",
    headers: { "x-revalidate-secret": config.revalidateSecret },
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => {
      if (!res.ok) console.warn(`Website revalidation returned ${res.status}`);
    })
    .catch((error: Error) => console.warn(`Website revalidation failed: ${error.message}`));
}
