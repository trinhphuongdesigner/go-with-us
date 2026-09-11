# CareerMate · Milo & Sage — asset pack v1

## Assets available in source

The public URL prefix is `/brand/careermate/v1/`.

| Folder | Contents | Format |
| --- | --- | --- |
| `icons/` | 43 interface icons and `sprite.svg` | SVG, 24 × 24 viewBox |
| `roadmap/` | Completed, current, upcoming and goal steps | SVG, 256 × 160 viewBox |
| `badges/` | Learning, feedback, teamwork and achievement | SVG, 160 × 176 viewBox |
| `illustrations/` | Book, mindmap and documents | SVG, 320 × 240 viewBox |
| `brand/` | Sage mark and a monochrome mark | SVG, 64 × 64 viewBox |

SVG artwork has no canvas background, sticker stroke, text labels, external fonts, scripts, linked images or network dependencies. Outlined icon geometry belongs to the Material icon family; there is no surrounding icon tile baked into the file.

The raster character exports are not yet included in this manifest. The five full-body RGB originals are preserved under `output/assets/careermate-v1/originals-white/`. They still have a white background and must not be treated as transparent PNGs. The requested transparent exports are pending permission for Python background removal.

## Next.js / React

The source helpers are in `src/components/brand/`:

```tsx
import { CareerMateAsset } from '@/components/brand/CareerMateAsset';
import { CareerMateIcon } from '@/components/brand/CareerMateIcon';

<CareerMateAsset name="step-current" width={160} />
<CareerMateAsset name="spot-mindmap" width={280} />
<CareerMateIcon name="roadmap" size={20} style={{ color: '#3E7868' }} />
```

`CareerMateAsset` uses `next/image`, sets the intrinsic aspect ratio, preserves transparency and defaults to decorative `alt=""`. Supply an informative alt only if the artwork carries information that is not already present in visible text.

`CareerMateIcon` loads a same-origin SVG symbol and inherits `currentColor`. Supported sizes are 18, 20 and 24 px. Beside a text label the icon is decorative. For icon-only controls, label the actual button; an SVG is not a button and does not supply keyboard behavior. A standalone informative icon can receive `label="..."`.

For other frameworks, use the files directly:

```html
<img src="/brand/careermate/v1/roadmap/step-current.svg"
     width="160" height="100" alt="">

<svg width="20" height="20" viewBox="0 0 24 24"
     fill="currentColor" aria-hidden="true" focusable="false">
  <use href="/brand/careermate/v1/icons/sprite.svg#roadmap"></use>
</svg>
```

An SVG loaded through `<img>` does not inherit the host element's `color`. Use the sprite component or a CSS mask when recoloring an icon. The monochrome brand mark follows the same rule. Colored roadmap, badge and illustration files use explicit palette colors so they can be placed directly with `<img>`.

Keep roadmap labels, percentages, connector paths, selection rings, focus states, tooltips and buttons in code. The four step images are decorative pieces; pair them with a visible status label, `aria-current="step"` for the active step and an appropriate disabled state where required. Avoid using color as the only status signal.

## Preview and rebuild

With the frontend running, open `/brand/careermate/v1/preview.html`. The gallery switches between beige, white, sage, dark and checker backgrounds; the checkerboard is CSS in the viewer and is not part of an asset.

`manifest.json` lists every published asset, URL and intrinsic size. `tokens.css` contains the sage / sand color variables.

From `frontend/`, rebuild the vector pack and registry:

```sh
node scripts/generate-careermate-assets.mjs
node scripts/build-careermate-registry.mjs
```

The vector generator uses the installed `@mui/icons-material` package. The current pack contains geometry extracted from version 9.4.0. Its MIT license is included in `LICENSE-icons.txt`; preserve it when redistributing the pack. Roadmap platforms, badges, spot illustrations and the stepped mark are composed as native SVG for this project. Badge and platform glyphs also use Material icon paths.

The new files are additive. Existing page layouts and the older `/milo-standing.png`, `/milo-avatar.png`, `/an-avatar.png` and composite roadmap image have not been replaced by this pack.
