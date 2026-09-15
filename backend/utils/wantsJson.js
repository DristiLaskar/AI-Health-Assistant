/*
 * Decides whether a failed request should get JSON or a redirect.
 *
 * Note req.originalUrl rather than req.path: inside a router mounted at /api,
 * req.path is only the tail ("/analyze"), so a prefix check against req.path
 * silently never matches and the browser gets a redirect where the page's
 * fetch() expected JSON.
 */
module.exports = (req) => {
    const url = req.originalUrl || req.url || '';
    return (
        req.xhr ||
        url.startsWith('/api') ||
        url.startsWith('/auth') ||
        (req.get('accept') || '').includes('application/json')
    );
};
