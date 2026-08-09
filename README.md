# pomatthew — portfolio

Static site. No build step, no npm, no framework. Open `index.html` and it works.

```
index.html          markup
config.js           >>> the only file you need to edit <<<
css/*.css           styles, split by section
js/space.js         starfield + nebula background
js/roblox.js        Roblox API layer (proxies, batching, caching)
js/globe.js         the draggable sphere of cards
js/games.js         Games section
js/player.js        video player (HTML5 + YouTube behind one UI)
js/media.js         Projects section
js/main.js          hero, skills, socials, contact form
assets/pfp.png      your avatar
assets/videos/      drop .mp4 / .webm files here
```

---

## Editing it

Everything lives in **`config.js`**. Save, refresh, done.

### Adding a game

```js
games: [
  { id: 10481791182, role: 'Gameplay Programmer' },
]
```

`id` is the **UniverseID**. Name, icon, visit count, live player count and
rating are pulled from Roblox at load, so you never type those in. `role` is
the only other field the card shows.

Finding a UniverseID: go to
[create.roblox.com/dashboard/creations](https://create.roblox.com/dashboard/creations),
click the experience, and take the number out of the address bar.

Entries carrying `hide: true` are skipped, so you can park an id without
deleting it.

### Adding a video

```js
videos: [
  { kind: 'youtube', id: 'YOUR_VIDEO_ID', title: '...', desc: '...' },
  { kind: 'file', src: 'assets/videos/combat.mp4', title: '...', desc: '...' },
]
```

For YouTube you can paste whatever YouTube hands you — a bare id, a
`youtu.be/...?si=...` share link, a full `watch?v=` url, a Shorts link. The
tracking suffix and everything else gets stripped. For a file, drop it in
`assets/videos/` and point `src` at it — the card thumbnail is grabbed
from a frame of the video automatically, or give it a `poster` image.

### Socials

```js
socials: {
  x:        { url: 'https://x.com/yourhandle',            handle: '@you' },
  linkedin: { url: 'https://linkedin.com/in/you',         handle: 'you' },
  discord:  { url: '',                                    handle: 'you' },
  roblox:   { url: 'https://roblox.com/users/123/profile', handle: 'you' },
}
```

Any platform with an empty `url` shows as a dashed placeholder icon so you
can see at a glance what's still unfilled. Discord is the exception — give
it just a `handle` and clicking copies it, which is what people actually
want from a Discord link.

---

## The contact form

`contact.to` is where messages land. `contact.mode` picks how:

**`'formsubmit'`** (default) — real inbox delivery with no server and no
signup, via [formsubmit.co](https://formsubmit.co).

> **One-time setup:** the first time the form is used, FormSubmit emails
> *you* a confirmation link. Until you click it, nothing gets through.
> Put the site up, submit the form once yourself, click the link in your
> inbox, and you're done permanently.

**`'mailto'`** — no third party. Opens the visitor's own mail app with
everything pre-filled. Works instantly, but is a dead end for anyone
without a mail client configured.

If FormSubmit fails for any reason, the form falls back to a mailto link
on its own and says so, so a message is never silently lost.

---

## How the Roblox numbers get in

Roblox's API doesn't send CORS headers, so a web page can't call it
directly — the browser blocks the response. The site goes through
community mirrors that do send them:

```js
options: { proxies: ['roproxy.com', 'rotunnel.com'] }
```

They're tried in order and the first one that answers gets remembered for
the rest of the session. If one is having a bad day the other covers it;
if both are down, the cards still render with your own text and a note
explaining why the numbers are missing.

Requests are batched into a single call for all your games, and icons are
cached for a day. Live player counts re-poll every 60s
(`options.refreshSeconds`, set `0` to turn it off).

---

## Putting it online

Drag the whole folder onto [app.netlify.com/drop](https://app.netlify.com/drop).
That's the entire process — you get a URL immediately.

For GitHub Pages: push the folder to a repo, then Settings → Pages → deploy
from `main` / root.

Opening `index.html` straight off your desktop mostly works, but two
things genuinely cannot work from a `file://` page:

- **YouTube will not play.** Not a bug in this site: YouTube refuses to
  embed in any page whose origin is `null`, which is what a local file is.
  The player detects this and shows the video's thumbnail with a
  **Watch on YouTube** button instead of a broken embed.
- **Thumbnails for local `.mp4`s** can't be grabbed, because the browser
  won't let a `file://` page read pixels out of another local file.

Both work the moment the folder is served over http. To check it locally
the way it'll really behave:

```
cd path/to/portfolio
python -m http.server 8000
```

then open <http://localhost:8000>.

---

## Player shortcuts

| key | does |
| --- | --- |
| `space` / `K` | play, pause |
| `J` / `L` | back / forward 10s |
| `←` `→` | back / forward 5s |
| `↑` `↓` | volume |
| `<` `>` | slower / faster (down to 0.25×, up to 4× on local files) |
| `M` | mute |
| `F` | fullscreen |
| `0`–`9` | jump to 0%–90% |
| `esc` | close |

Double-clicking the left or right edge of the video skips 10s; double
clicking the middle goes fullscreen.

Elsewhere on the page, `G` flips the games between globe and grid.
