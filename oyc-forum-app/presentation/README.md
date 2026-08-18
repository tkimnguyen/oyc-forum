# Generating the presentation

`PRESENTATION.md` is a [Marp](https://marp.app/) slide deck. Marp turns a single
Markdown file (plus the images it references in `images/`) into a slideshow —
you can preview it in an editor, or export it to a standalone HTML file or a
PDF.

## One-time setup

Marp is run through `npx`, so nothing needs to be installed ahead of time —
the first run downloads it automatically. You do need a Chromium-based
browser or Firefox on the machine doing the export, since Marp renders each
slide in a real browser to produce PDF/PNG/PPTX output. Most machines already
have Chrome installed; if the export command below can't find a browser, see
"No browser found" at the bottom of this file.

## Generate the PDF

From the project root:

```
npx @marp-team/marp-cli presentation/PRESENTATION.md --allow-local-files -o presentation/deck.pdf
```

## Generate the HTML

```
npx @marp-team/marp-cli presentation/PRESENTATION.md --allow-local-files -o presentation/deck.html
```

The output file's format is inferred from the `-o` extension (`.pdf`, `.html`,
`.pptx`, or `.png`/`.jpg` for a single image per slide) — swap the extension
above to switch formats.

## Why `--allow-local-files`

The deck's screenshots live in `presentation/images/` and are referenced with
plain relative paths (e.g. `images/home.png`). Marp treats local file access
as a security risk by default (a shared/untrusted `.md` could otherwise read
arbitrary files off your disk) and blocks it unless you pass this flag. Since
this deck and its images are both part of the repo you already trust, it's
safe to include.

## Live preview while editing

Marp can also watch the file and auto-reload a preview as you edit:

```
npx @marp-team/marp-cli presentation/PRESENTATION.md --allow-local-files --watch --preview
```

## "No browser found" error

If the export command fails with an error like "No suitable browser found",
Marp couldn't locate Chrome, Edge, or Firefox on your machine. Either install
one of those, or point Marp at a specific browser binary:

```
CHROME_PATH=/path/to/chrome npx @marp-team/marp-cli presentation/PRESENTATION.md --allow-local-files -o presentation/deck.pdf
```
