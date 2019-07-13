# webmention.js
Client-side library for rendering webmentions from webmention.io

## Usage

1. Copy webmention.js to your website and put it somewhere sensible
2. Put a `<div id="webmentions"></div>` where you want your webmentions to be
   embedded
3. Put a `<script src="/path/to/webmention.js" async></script>`
   somewhere on your page (typically inside `<head>` but it doesn't really matter)
4. You'll probably want to add some CSS rules to your stylesheet, in particular:

    #webmentions img { max-height: 1.2em; margin-right: -1ex; }

    See the included `webmention.css` file for an example.

You can also pass in some arguments, for example:

```html
<script src="webmention.js" data-id="webmention-container">
```

Accepted arguments:

* `data-page-url` - use this reference URL instead of the current browser location
* `data-id` - use this container ID instead of "webmentions"
* `data-wordcount` - truncate the reply to this many words (adding an ellipsis to
    the end of the last word)

This is a quick hack that could be a lot better.
