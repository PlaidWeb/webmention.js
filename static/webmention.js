/* webmention.js

Simple thing for embedding webmentions from webmention.io into a page, client-side.

(c)2018-2022 fluffy (http://beesbuzz.biz)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

GitHub repo (for latest released versions, issue tracking, etc.):

    https://github.com/PlaidWeb/webmention.js

Basic usage:

<script src="/path/to/webmention.js" data-param="val" ... async />
<div id="webmentions"></div>

Allowed parameters:

    page-url:

        The base URL to use for this page. Defaults to window.location

    add-urls:

        Additional URLs to check, separated by |s

    id:

        The HTML ID for the object to fill in with the webmention data.
        Defaults to "webmentions"

    wordcount:

        The maximum number of words to render in reply mentions.

    max-webmentions:

        The maximum number of mentions to retrieve. Defaults to 30.

    prevent-spoofing:

        By default, Webmentions render using the mf2 'url' element, which plays
        nicely with webmention bridges (such as brid.gy and telegraph)
        but allows certain spoofing attacks. If you would like to prevent
        spoofing, set this to a non-empty string (e.g. "true").

    sort-by:

        What to order the responses by; defaults to 'published'. See
        https://github.com/aaronpk/webmention.io#api

    sort-dir:

        The order to sort the responses by; defaults to 'up' (i.e. oldest
        first). See https://github.com/aaronpk/webmention.io#api

    comments-are-reactions:

        If set to a non-empty string (e.g. "true"), will display comment-type responses
        (replies/mentions/etc.) as being part of the reactions
        (favorites/bookmarks/etc.) instead of in a separate comment list.

A more detailed example:

<!-- If you want to translate the UI -->
<script src="/path/to/umd/i18next.js"></script>
<script>
    // Setup i18next as described in https://www.i18next.com/overview/getting-started#basic-sample
</script>
<!-- Otherwise, only using the following is fine -->
<script src="/path/to/webmention.min.js"
    data-id="webmentionContainer"
    data-wordcount="30"
    data-prevent-spoofing="true"
    data-comments-are-reactions="true"
    />

*/

// Begin LibreJS code licensing
// @license magnet:?xt=urn:btih:d3d9a9a6595521f9666a5e94cc830dab83b65699&dn=expat.txt

(function () {
  "use strict";

  // Shim i18next
  window.i18next = window.i18next || {
    t: function t(/** @type {string} */key) { return key; }
  }
  const t = window.i18next.t.bind(window.i18next);

  /**
   * Read the configuration value.
   *
   * @param {string} key The configuration key.
   * @param {string} dfl The default value.
   * @returns {string}
   */
  function getCfg(key, dfl) {
    return document.currentScript.getAttribute("data-" + key) || dfl;
  }

  const refurl = getCfg("page-url", window.location.href.replace(/#.*$/, ""));
  const addurls = getCfg("add-urls", undefined);
  const containerID = getCfg("id", "webmentions");
  /** @type {Number} */
  const textMaxWords = getCfg("wordcount");
  const maxWebmentions = getCfg("max-webmentions", 30);
  const mentionSource = getCfg("prevent-spoofing") ? "wm-source" : "url";
  const sortBy = getCfg("sort-by", "published");
  const sortDir = getCfg("sort-dir", "up");
  /** @type {boolean} */
  const commentsAreReactions = getCfg("comments-are-reactions");

  /**
   * @typedef MentionType
   * @type {"in-reply-to"|"like-of"|"repost-of"|"bookmark-of"|"mention-of"|"rsvp"|"follow-of"}
   */

  /**
   * Maps a reaction to a hover title.
   *
   * @type {Record<MentionType, string>}
   */
  const reactTitle = {
    "in-reply-to": t("replied"),
    "like-of": t("liked"),
    "repost-of": t("reposted"),
    "bookmark-of": t("bookmarked"),
    "mention-of": t("mentioned"),
    "rsvp": t("RSVPed"),
    "follow-of": t("followed")
  };

  /**
   * Maps a reaction to an emoji.
   *
   * @type {Record<MentionType, string>}
   */
  const reactEmoji = {
    "in-reply-to": "💬",
    "like-of": "❤️",
    "repost-of": "🔄",
    "bookmark-of": "⭐️",
    "mention-of": "💬",
    "rsvp": "📅",
    "follow-of": "🐜"
  };

  /**
   * @typedef RSVPEmoji
   * @type {"yes"|"no"|"interested"|"maybe"|null}
   */

  /**
   * Maps a RSVP to an emoji.
   *
   * @type {Record<RSVPEmoji, string>}
   */
  const rsvpEmoji = {
    "yes": "✅",
    "no": "❌",
    "interested": "💡",
    "maybe": "💭"
  };

  /**
   * HTML escapes the string.
   *
   * @param {string} text The string to be escaped.
   * @returns {string}
   */
  function entities(text) {
    return text.replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Creates the markup for an reaction image.
   *
   * @param {Reaction} r
   * @param {boolean} isComment
   * @returns {string}
   */
  function reactImage(r, isComment) {
    const who = entities(
      r.author?.name || r.url.split("/")[2]
    );
    /** @type {string} */
    let response = reactTitle[r["wm-property"]] || t("reacted");
    if (!isComment && r.content && r.content.text) {
      response += ": " + extractComment(r);
    }

    let authorPhoto = '';
    if (r.author && r.author.photo) {
      authorPhoto = `
        <img
          src="${entities(r.author.photo)}"
          loading="lazy"
          decoding="async"
          alt="${who}"
        >
      `;
    }

    let rsvp = '';
    if (r.rsvp && rsvpEmoji[r.rsvp]) {
      rsvp = `<sub>${rsvpEmoji[r.rsvp]}</sub>`;
    }

    return`
      <a
        class="reaction"
        rel="nofollow ugc"
        title="${who} ${response}"
        href="${r[mentionSource]}"
      >
        ${authorPhoto}
        ${(reactEmoji[r['wm-property']] || '💥')}
        ${rsvp}
      </a>
    `;
  }

  /**
   * Strip the protocol off a URL.
   *
   * @param {string} url The URL to strip protocol off.
   * @returns {string}
   */
  function stripurl(url) {
    return url.substr(url.indexOf('//'));
  }

  /**
   * Deduplicate multiple mentions from the same source URL.
   *
   * @param {Array<Reaction>} mentions Mentions of the source URL.
   * @return {Array<Reaction>}
   */
  function dedupe(mentions) {
    /** @type {Array<Reaction>} */
    const filtered = [];
    /** @type {Record<string, boolean>} */
    const seen = {};

    mentions.forEach(function(r) {
      // Strip off the protocol (i.e. treat http and https the same)
      const source = stripurl(r.url);
      if (!seen[source]) {
        filtered.push(r);
        seen[source] = true;
      }
    });

    return filtered;
  }

  /**
   * Extract comments from a reaction.
   *
   * @param {Reactions} c
   * @returns string
   */
  function extractComment(c) {
    let text = entities(c.content.text);

    if (textMaxWords) {
      let words = text.replace(/\s+/g,' ').split(' ', textMaxWords + 1);
      if (words.length > textMaxWords) {
        words[textMaxWords - 1] += '&hellip;';
        words = words.slice(0, textMaxWords);
        text = words.join(' ');
      }
    }

    return text;
  }

  /**
   * Format comments as HTML.
   *
   * @param {Array<Reaction>} comments The comments to format.
   * @returns string
   */
  function formatComments(comments) {
    const headline = `<h2>${t('Responses')}</h2>`;
    const markup = comments
      .map((c) => {
        const image = reactImage(c, true);

        let source = entities(c.url.split('/')[2]);
        if (c.author && c.author.name) {
          source = entities(c.author.name);
        }
        const link = `<a class="source" rel="nofollow ugc" href="${c[mentionSource]}">${source}</a>`;

        let linkclass = "name";
        let linktext = `(${t("mention")})`;
        if (c.name) {
          linkclass = "name";
          linktext = c.name;
        } else if (c.content && c.content.text) {
          linkclass = "text";
          linktext = extractComment(c);
        }

        const type = `<span class="${linkclass}">${linktext}</span>`;

        return `<li>${image} ${link} ${type}</li>`;
      })
    .join('');
    return `
      ${headline}
      <ul class="comments">${markup}</ul>
    `;
  }

  /**
   * @typedef {Object} Reaction
   * @property {string}      url
   * @property {Object?}     author
   * @property {string?}     author.name
   * @property {string?}     author.photo
   * @property {Object?}     content
   * @property {string?}     content.text
   * @property {RSVPEmoji?}  rsvp
   * @property {MentionType?} wm-property
   * @property {string?}     wm-source
   */

  /**
   * Formats a list of reactions as HTML.
   *
   * @param {Array<Reaction>} reacts List of reactions to format
   * @returns string
   */
  function formatReactions(reacts) {
    const headline = `<h2>${t('Reactions')}</h2>`;

    const markup = reacts.map((r) => reactImage(r)).join('');

    return `
      ${headline}
      <ul class="reacts">${markup}</ul>
    `;
  }

  /**
   * @typedef WebmentionResponse
   * @type {Object}
   * @property {Array<Reaction>} children
   */

  /**
   * Register event listener.
   */
  window.addEventListener("load", async function () {
    const container = document.getElementById(containerID);
    if (!container) {
      // no container, so do nothing
      return;
    }

    const pages = [stripurl(refurl)];
    if (!!addurls) {
      addurls.split('|').forEach(function (url) {
        pages.push(stripurl(url));
      });
    }

    let apiURL = `https://webmention.io/api/mentions.jf2?per-page=${maxWebmentions}&sort-by=${sortBy}&sort-dir=${sortDir}`;

    pages.forEach(function (path) {
      apiURL += `&target[]=${encodeURIComponent('http:' + path)}&target[]=${encodeURIComponent('https:' + path)}`;
    });

    /** @type {WebmentionResponse} */
    let json = {};
    try {
      const response = await window.fetch(apiURL);
      if (response.status >= 200 && response.status < 300) {
        json = await response.json();
      } else {
        console.error("Could not parse response");
        new Error(response.statusText);
      }
    } catch(error) {
      // Purposefully not escalate further, i.e. no UI update
      console.error("Request failed", error);
    }

    /** @type {Array<Reaction>} */
    let comments = [];
    /** @type {Array<Reaction>} */
    const collects = [];

    if (commentsAreReactions) {
      comments = collects;
    }

    /** @type {Record<MentionType, Array<Reaction>>} */
    const mapping = {
      "in-reply-to": comments,
      "like-of": collects,
      "repost-of": collects,
      "bookmark-of": collects,
      "follow-of": collects,
      "mention-of": comments,
      "rsvp": comments
    };

    json.children.forEach(function(child) {
      // Map each mention into its respective container
      const store = mapping[child['wm-property']];
      if (store) {
        store.push(child);
      }
    });

    // format the comment-type things
    let formattedComments = '';
    if (comments.length > 0 && comments !== collects) {
      formattedComments = formatComments(dedupe(comments));
    }

    // format the other reactions
    let reactions = '';
    if (collects.length > 0) {
      reactions = formatReactions(dedupe(collects));
    }

    container.innerHTML = `${formattedComments}${reactions}`;
  });
}());

// End-of-file marker for LibreJS
// @license-end
