# webmention.js
Client-side library for rendering webmentions from [webmention.io](https://webmention.io/)

## Usage

1. Copy the Javascript file (`webmention.min.js`) from the `static/` directory to
    somewhere on your website
2. Put a `<div id="webmentions"></div>` where you want your webmentions to be
    embedded
3. Put a `<script src="/path/to/webmention.min.js" async></script>`
    somewhere on your page (typically inside `<head>` but it doesn't really
    matter), replacing `/path/to/` with whatever directory the Javascript
    file is in
4. You'll probably want to add some CSS rules to your stylesheet, in particular:

    `#webmentions img { max-height: 1.2em; margin-right: -1ex; }`

    See the included `webmention.css` file for an example.

You can also pass in some arguments, for example:

```html
<script src="/path/to/webmention.min.js" data-id="webmention-container" async></script>
```

Note that the `async` isn't strictly necessary but it can speed up apparent page
loads.

Accepted arguments (see the source in `static/webmention.js` for more details):

* `page-url` -- use this reference URL instead of the current browser location
* `add-urls` -- additional URLs to include, separated by a `|`
* `id` -- use this container ID instead of "webmentions"
* `wordcount` -- truncate the reply to this many words (adding an ellipsis to
    the end of the last word)
* `max-webmentions` -- the maximum webmentions to retrieve and render (defaults
    to 30)
* `prevent-spoofing` -- set this to use the incoming mention source URL instead
    of the declared URL; setting this will disable one form of identity spoofing
    but will make mentions from webmention bridges (such as
    [brid.gy](https://brid.gy) or [Telegraph](https://telegraph.p3k.io/))
    significantly uglier

Look at the source code itself for more detailed information.

## Development

To produce a minified JS, first install Node dependencies (via `npm install`) and
then run `npm run minify`.
