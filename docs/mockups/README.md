# Design mockups (snapshot, October 5, 2026)

Source files for the Worm design canvas: five themes, eight screens each (40 screens), plus `canvas.json` (the canvas layout).

- These are a backup of the mockup artwork, not app code. The app is built from `docs/design.md`.
- File prefixes: `Main`/`A-` Café Bookshop, `B-` Fantasy, `C-` Superhero, `D-` Mystery, `E-` Sci-fi.
- Each scene is inline SVG inside its file, so the artwork can be reused directly when the real screens are built.
- The files load `support.js` from the design canvas, so they will not render by themselves in a browser.
- The design is not locked. When screens change on the canvas, replace this folder with a new snapshot.
- `motion-question-press.html` is a standalone, tappable motion prototype for the question screen (Café Bookshop). Unlike the screen files, it opens directly in a browser.
- `motion-reveal.html` is a standalone, tappable motion prototype for the reveal screen (Café Bookshop): wrapping, the three reveal styles, tilt and closer look. It also opens directly in a browser.
- `motion-loading.html` is a standalone motion prototype for the loading screen (Café Bookshop): living scene, staged entrance, three stage bars, and the hand-off to the reveal. It runs the wait in about 20 seconds and also opens directly in a browser.
