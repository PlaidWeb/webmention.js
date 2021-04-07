/* webmention.js

Simple thing for embedding webmentions from webmention.io into a page, client-side.

(c)2018-2021 fluffy (http://beesbuzz.biz)

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


(function () {
    "use strict";

    // Shim i18next
    window.i18next = window.i18next || {
      t: function t(key) { return key; }
    }
    var t = window.i18next.t.bind(window.i18next);

    function getCfg(key, dfl) {
        return document.currentScript.getAttribute("data-" + key) || dfl;
    }

    var refurl = getCfg('page-url',
                        window.location.href.replace(/#.*$/, ''));
    var addurls = getCfg('add-urls', undefined);
    var containerID = getCfg('id', "webmentions");
    var textMaxWords = getCfg('wordcount');
    var maxWebmentions = getCfg('max-webmentions', 30);
    var mentionSource = getCfg('prevent-spoofing') ? 'wm-source' : 'url';
    var sortBy = getCfg('sort-by', 'published');
    var sortDir = getCfg('sort-dir', 'up');
    var commentsAreReactions = getCfg('comments-are-reactions');

    var reactTitle = {
        'in-reply-to': t('replied'),
        'like-of': t('liked'),
        'repost-of': t('reposted'),
        'bookmark-of': t('bookmarked'),
        'mention-of': t('mentioned'),
        'rsvp': t('RSVPed'),
        'follow-of': t('followed')
    };

    var reactEmoji = {
        'in-reply-to': '💬',
        'like-of': '❤️',
        'repost-of': '🔄',
        'bookmark-of': '⭐️',
        'mention-of': '💬',
        'rsvp': '📅',
        'follow-of': '🐜'
    };

    var rsvpEmoji = {
        'yes': '✅',
        'no': '❌',
        'interested': '💡',
        'maybe': '💭'
    };

    function entities(text) {
        return text.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function reactImage(r, isComment) {
        var who = entities((r.author && r.author.name)
                           ? r.author.name
                           : r.url.split('/')[2]);
        var response = reactTitle[r['wm-property']] || t('reacted');
        if (!isComment && r.content && r.content.text) {
            response += ": " + extractComment(r);
        }
        var html = '<a class="reaction" rel="nofollow ugc" title="' + who + ' ' +
            response + '" href="' + r[mentionSource] + '">';
        if (r.author && r.author.photo) {
            html += '<img src="' + entities(r.author.photo) +
                '" loading="lazy" decoding="async" alt="' + who + '">';
        }
        html += (reactEmoji[r['wm-property']] || '💥');
        if (r.rsvp && rsvpEmoji[r.rsvp]) {
            html += '<sub>' + rsvpEmoji[r.rsvp] + '</sub>';
        }
        html += '</a>';

        return html;
    }

    // strip the protocol off a URL
    function stripurl(url) {
        return url.substr(url.indexOf('//'));
    }

    // Deduplicate multiple mentions from the same source URL
    function dedupe(mentions) {
        var filtered = [];
        var seen = {};

        mentions.forEach(function(r) {
            // Strip off the protocol (i.e. treat http and https the same)
            var source = stripurl(r.url);
            if (!seen[source]) {
                filtered.push(r);
                seen[source] = true;
            }
        });

        return filtered;
    }

    function extractComment(c) {
        var text = entities(c.content.text);

        if (textMaxWords) {
            var words = text.replace(/\s+/g,' ')
                .split(' ', textMaxWords + 1);
            if (words.length > textMaxWords) {
                words[textMaxWords - 1] += '&hellip;';
                words = words.slice(0, textMaxWords);
                text = words.join(' ');
            }
        }

        return text;
    }

    function formatComments(comments) {
        var html = '<h2>' + t('Responses') + '</h2><ul class="comments">';
        comments.forEach(function(c) {
            html += '<li>';

            html += reactImage(c, true);

            html += ' <a class="source" rel="nofollow ugc" href="' +
                c[mentionSource] + '">';
            if (c.author && c.author.name) {
                html += entities(c.author.name);
            } else {
                html += entities(c.url.split('/')[2]);
            }
            html += '</a>: ';

            var linkclass;
            var linktext;
            if (c.name) {
                linkclass = "name";
                linktext = c.name;
            } else if (c.content && c.content.text) {
                linkclass = "text";
                linktext = extractComment(c);
            } else {
                linkclass = "name";
                linktext = "(" + t("mention") + ")";
            }

            html += '<span class="' + linkclass + '">' + linktext + '</span>';

            html += '</li>';
        });
        html += '</ul>';

        return html;
    }

    function formatReactions(reacts) {
        var html = '<h2>' + t('Reactions') + '</h2><ul class="reacts">';

        reacts.forEach(function(r) {
            html += reactImage(r);
        });

        return html;
    }

    function getData(url, callback) {
        if (window.fetch) {
            window.fetch(url).then(function(response) {
                if (response.status >= 200 && response.status < 300) {
                    return Promise.resolve(response);
                } else {
                    return Promise.reject(new Error(response.statusText));
                }
            }).then(function(response) {
                return response.json();
            }).then(callback).catch(function(error) {
                console.error("Request failed", error);
            });
        } else {
            var oReq = new XMLHttpRequest();
            oReq.onload = function(data) {
                callback(JSON.parse(data));
            };
            oReq.onerror = function(error) {
                console.error("Request failed", error);
            };
        }
    }

    window.addEventListener("load", function () {
        var container = document.getElementById(containerID);
        if (!container) {
            // no container, so do nothing
            return;
        }

        var pages = [stripurl(refurl)];
        if (!!addurls) {
            addurls.split('|').forEach(function (url) {
                pages.push(stripurl(url));
            })
        }

        var apiURL = 'https://webmention.io/api/mentions.jf2?per-page=' +
            maxWebmentions + '&sort-by=' + sortBy + '&sort-dir=' + sortDir;

        pages.forEach(function (path) {
            apiURL += '&target[]=' + encodeURIComponent('http:' + path) +
                '&target[]=' + encodeURIComponent('https:' + path);
        });

        getData(apiURL, function(json) {
            var html = '';

            var comments = [];
            var collects = [];
            if (commentsAreReactions) {
                comments = collects;
            }

            var mapping = {
                "in-reply-to": comments,
                "like-of": collects,
                "repost-of": collects,
                "bookmark-of": collects,
                "mention-of": comments,
                "rsvp": comments
            };

            json.children.forEach(function(c) {
                var store = mapping[c['wm-property']];
                if (store) {
                    store.push(c);
                }
            });

            // format the comment-type things
            if (comments.length > 0 && comments !== collects) {
                html += formatComments(dedupe(comments));
            }

            // format the other reactions
            if (collects.length > 0) {
                html += formatReactions(dedupe(collects));
            }

            container.innerHTML = html;
        });
    });

}());
