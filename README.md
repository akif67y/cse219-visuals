# CSE 219 · Signals & Linear Systems

A static course website for interactive Signals and Linear Systems demos. The
site is built from plain HTML, CSS, and JavaScript, so it runs entirely in the
browser with no backend, no build step, and no package install.

The pages are meant for course use: students can open a demo, manipulate the
signals visually, and hear or see the result locally in their browser. Uploaded
or recorded data stays on the user's machine.

## Run Locally

Use a current version of Chrome, Edge, or Firefox. The audio demos load local
clips with `fetch`, and microphone recording needs a secure browser context, so
run the site through a local server.

On Windows, double-click `serve.cmd` or run it from Command Prompt:

```bat
serve.cmd
```

On macOS or Linux, run:

```bash
./serve.sh
```

Then open:

```text
http://127.0.0.1:8000/
```

Keep the server window open while using the demos. Press Ctrl+C there to stop
it. You can choose a different port by passing it as the first argument:

```bash
serve.cmd 9000
```

On macOS or Linux, use `./serve.sh 9000` instead. Both launchers require
Python 3; no Python packages, Node packages, or build tools are needed.

## Project Structure

```text
.
├── index.html                  # Home page with links to demos
├── *.html                      # Individual interactive demo pages
├── assets/
│   ├── site.css                # Shared site shell and layout styles
│   ├── site.js                 # Shared sidebar, navigation, and footer
│   ├── audio-fourier.js        # Shared browser-side audio/DSP helpers
│   └── audios/
│       ├── library.json        # Audio clip manifest
│       └── *.mp3               # Stored audio clips
├── docs/                       # Supporting notes
├── ref/                        # Reference source files
├── favicon.svg
└── serve.sh                    # Local static server helper
```

## Editing The Site

The sidebar is generated from `assets/site.js`. Update the brand, navigation
links, or footer there and every page using the shared sidebar will pick it up.

Each demo page should include:

```html
<link rel="stylesheet" href="assets/site.css" />
<script src="assets/site.js" defer></script>
<aside class="sidebar" id="siteSidebar"></aside>
```

Audio pages use `assets/audio-fourier.js` for shared playback, waveform,
spectrum, FFT/STFT, and audio-library helpers. Stored clips are listed in
`assets/audios/library.json`.

## Deployment

The site can be hosted on any static file host. For GitHub Pages:

1. Push the files to a GitHub repository.
2. Open repository Settings -> Pages.
3. Choose "Deploy from a branch."
4. Select the branch and folder containing `index.html`.
5. Save.

No server-side runtime is required; `index.html` is the landing page and all
interactivity runs client-side.
