/* Small helpers shared by every page. No framework, no build step. */

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/* Anything that comes back from the API is treated as text, never as markup. */
const esc = (value) =>
    String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

async function api(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        ...options
    });

    let body = {};
    try {
        body = await response.json();
    } catch (error) {
        body = {};
    }

    if (!response.ok) {
        // The session ran out while the tab was open.
        if (response.status === 401) {
            window.location.href = '/login';
        }
        if (response.status === 403 && body.redirectUrl) {
            window.location.href = body.redirectUrl;
        }
        const err = new Error(body.message || 'Something went wrong. Please try again.');
        err.status = response.status;
        throw err;
    }

    return body;
}

function showNotice(el, message, kind = 'error') {
    if (!el) return;
    el.textContent = message;
    el.className = `notice notice--${kind}`;
    el.hidden = false;
}

function hideNotice(el) {
    if (el) el.hidden = true;
}

/* Sign out needs to be a POST so a stray link or image cannot trigger it. */
function wireSignOut() {
    $$('[data-signout]').forEach((button) => {
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                await api('/auth/logout', { method: 'POST' });
            } catch (error) {
                /* falling through to the redirect is fine */
            }
            window.location.href = '/login';
        });
    });
}

document.addEventListener('DOMContentLoaded', wireSignOut);
