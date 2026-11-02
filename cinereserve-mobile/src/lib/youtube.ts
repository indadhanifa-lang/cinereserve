/**
 * Video id from a YouTube link (watch?v=, youtu.be/, /embed/, /shorts/),
 * or null for anything else so the caller can fall back to a plain link.
 */
export function youtubeId(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  const id =
    host === 'youtu.be'
      ? url.pathname.slice(1)
      : host === 'youtube.com' || host === 'youtube-nocookie.com'
        ? url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]
        : null;
  // Ids are 11 chars of [A-Za-z0-9_-]; anything else is not embeddable.
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
