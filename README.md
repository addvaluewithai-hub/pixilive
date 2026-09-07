# PixiLive

A tiny open-source experiment for building expressive 2D AI characters directly in the browser with PixiJS.

## Nova prototype

The `demo/pixi-character` branch contains **Nova**, a character drawn entirely with PixiJS vector graphics — no character image assets.

What is already in the prototype:

- procedural idle motion, breathing and floating
- automatic blinking
- cursor-driven gaze
- animated ears, tail, antenna and arms
- four emotion states: calm, happy, curious and excited
- smooth mouth interpolation across open / width / roundness parameters
- a scripted viseme demo
- microphone-driven mouth motion using Web Audio frequency analysis
- responsive desktop/mobile layout

## Run it

Because microphone access requires a secure context, serve the folder through localhost instead of opening the HTML file directly:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

No build step is required. PixiJS is loaded from jsDelivr.

## Why this prototype exists

The goal is to test how far a lightweight, fully controllable 2D character engine can go before introducing Rive, Live2D, Spine or a hosted avatar service. The next step would be replacing the frequency-based microphone mouth driver with provider phoneme/viseme timings for accurate AI speech lip sync.
