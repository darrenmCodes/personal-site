# darren maher

from carlow. living in dublin.

who i am, what i’ve made, what i’m reading, and how to reach me. set in brygada 1918, with a little 3d bookshelf after [adammaj](https://x.com/MajmudarAdam). footer quotes from epictetus and friends.

## run it

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm typecheck
pnpm lint
```

## edit the words

almost everything on the page is data, not code.

| file | what it is |
| --- | --- |
| `content/site.json` | name, bio, now, made, bookshelf, contact, elsewhere |
| `content/quotes.json` | rotating footer quotes |
| `content/books.json` | cover metadata pulled for the shelf |

leave a field empty (or `null`) and that bit simply doesn’t show.

covers for the shelf:

```bash
pnpm books
```

## stack

next.js, react, three.js for the shelf. locally only for now — no deploy wired up yet.
