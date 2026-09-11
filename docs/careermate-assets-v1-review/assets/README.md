# CareerMate asset generation

The implementation assets are under `frontend/public/brand/careermate/v1/`. See the README there for usage and the current export status.

## Character originals

All five originals are 1254 × 1254 RGB PNGs. These are white-background intermediate renders, not alpha PNGs.

- `originals-white/milo-standing.png`: the approved Milo from the Figma design, holding a tablet.
- `originals-white/milo-wave.png`: welcoming pose.
- `originals-white/milo-guide.png`: open hand guiding toward the next step.
- `originals-white/milo-celebrate.png`: restrained celebration.
- `originals-white/an-welcome.png`: fictional human mentor An.

Generated with the built-in `image_gen` tool. The exact new generation prompts are in `generation-prompts.json`. Each pose was generated independently from the approved identity reference. A generated checkerboard candidate was rejected and is not included.

The user has been asked to authorize Python background removal because the image generation tool returned RGB rather than a real alpha channel. No raster edits have been performed pending that answer.
