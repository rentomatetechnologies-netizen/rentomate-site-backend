import { config } from "../config";

/**
 * Tells Bing (and the other IndexNow search engines, which share submissions) that these website pages were added,
 * changed or removed, so they are recrawled within minutes. Bing's index is what ChatGPT search and Copilot answer
 * from. Runs in the background; failures are only logged. Off unless INDEXNOW_KEY is set.
 */
export function notifyIndexNow(paths: string[]) {
  if (!config.indexNowKey || paths.length === 0) return;
  fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(config.siteUrl).host,
      key: config.indexNowKey,
      // The website serves the key at this URL (rentomate-frontend/public/indexnow-key.txt), proving we own the site.
      keyLocation: `${config.siteUrl}/indexnow-key.txt`,
      urlList: [...new Set(paths)].map((path) => `${config.siteUrl}${path}`),
    }),
    signal: AbortSignal.timeout(10000),
  })
    .then((res) => {
      if (!res.ok) console.warn(`IndexNow returned ${res.status}`);
    })
    .catch((error: Error) => console.warn(`IndexNow failed: ${error.message}`));
}
