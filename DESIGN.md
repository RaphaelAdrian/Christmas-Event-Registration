# Design system: Neon Christmas

The look of the EMC-Christmas-Party Fest! 2026 site. It is taken from one reference illustration (crimson field, black and white figure, acid green and cyan accents, violet edges, jagged shards, print grain). The illustration is a style reference only and never appears on the site.

The idea in one line: **the party's red, green and white, played as a cyberpunk night.** Christmas lives in the palette and the parol; cyberpunk lives in the hard edges, the shards and the glitch.

## 1. Principles

1. **Flat and hard.** Solid fills, hard edges, zero blur. Depth comes from offset blocks, not soft shadows or glows.
2. **Cut, never rounded.** Corners are chamfered or sliced. Border radius is 0 everywhere; only the parol's ring is round.
3. **Three fields carry the page.** Void black, Signal red and Bone white take turns as whole section backgrounds. Neighbouring sections never share a field.
4. **Green is the action.** Acid green marks what you can do (buttons, focus, the current step). Never decoration.
5. **Cyan is the signal.** Only for live or personal data: the countdown seconds, the reference code, the status that changed.
6. **One loud moment.** The hero name glitches in once on load. Everything else enters quietly.

## 2. Colour

| Token | Hex | Role |
| --- | --- | --- |
| `--void` | `#000000` | Main ground, ink on light fields |
| `--void-2` | `#121014` | Raised surface on black (cards that must exist: form sheet, pass body, lightbox controls) |
| `--void-3` | `#1E1A21` | Field background, second step on black |
| `--signal` | `#E8183F` | Crimson field (countdown, the action band), destructive buttons |
| `--signal-deep` | `#A80F2D` | Shadow side of red: pressed states, red-on-red steps |
| `--bone` | `#FAF5F7` | Text on dark, the inverse field (footer, admin work surfaces) |
| `--bone-2` | `#EDE4E8` | Step on bone |
| `--ash` | `#B9B0B5` | Secondary text on black (never for running text) |
| `--acid` | `#1DF06B` | Primary actions, focus, current step |
| `--acid-deep` | `#0FB84D` | Hover/pressed acid |
| `--cyan` | `#19C8FF` | Live/personal data only |
| `--uv` | `#8B3DFF` | The offset edge: hard shadow blocks, misregistration on display type |

### Allowed pairs (WCAG 2.1)

| Text / on | Contrast | Use |
| --- | --- | --- |
| Bone on Void | 19.5 : 1 | All running text on black |
| Ash on Void | 9.9 : 1 | Secondary notes |
| Void on Acid | 13.7 : 1 | Primary buttons |
| Cyan on Void | 10.7 : 1 | Reference codes, live numbers |
| Void on Signal | 4.6 : 1 | **All text on the red fields** (black on red, as in the reference) |
| Bone on Signal | 4.2 : 1 | Large type only on red (24px+, or 19px+ bold) |
| Bone on Signal-deep | 7.0 : 1 | Text on the pressed/deep red |
| Bone on UV | 4.6 : 1 | Chips and labels on violet |
| Void on Bone | 19.5 : 1 | Footer, admin |

**Never:** acid text on red (3.0 : 1), cyan on bone (1.8 : 1), bone running text on red (4.2 : 1). Red text on black passes (4.6 : 1) but is kept for errors only.

(Ratios computed from the hex values with the WCAG 2.1 formula.)

### Field sequence on the home page

| Section | Field | Why |
| --- | --- | --- |
| Hero | Photo under a void scrim | The resort at dusk does the work |
| Countdown | Signal red + grain | The billboard moment |
| Getting there | Void | Type steps across |
| The venue | Void-3 | One step up so it separates from Getting there without a line |
| Good to know | Void | |
| Your pass | Signal red + grain | Second red moment, the live ticket |
| Photos | Void | Photos sit bright on black |
| Action band | Acid | The whole band is the button |
| Footer | Bone | Inverse close, name cropped in black |

## 3. Type

| Role | Family | Settings |
| --- | --- | --- |
| Display | **Big Shoulders** (Google Fonts, variable; its optical size gives the Display cut at large sizes), 800 and 900 | Uppercase, tracking -0.01em, leading 0.86. Poster-condensed, so the event name can be enormous on a phone |
| Text | **Chakra Petch** (Google Fonts), 400, 500, 600 | Sentence case, tracking 0, leading 1.55. Its cut terminals echo the shards |

Two families, nothing else. No monospace anywhere.

| Step | Size | Use |
| --- | --- | --- |
| `--step-small` | 14px | Hints, captions, admin meta |
| `--step-body` | 17–19px | Running text, fields, buttons |
| `--step-lead` | 22–28px | Statements, card titles (Chakra Petch 600) |
| `--step-head` | 40–80px | Section headings (Big Shoulders 900, uppercase) |
| Display | fitted, up to 24vw | The event name, the countdown digits, the band word |

Rules: uppercase only at `--step-head` and above. Never style one word differently inside a headline. Headlines stay within two lines at every width.

## 4. Shape language

**Chamfer.** Every box (button, field, card, photo frame) loses two opposite corners:

```css
--cut: 12px;
clip-path: polygon(var(--cut) 0, 100% 0, 100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%, 0 100%, 0 var(--cut));
```

Small controls use `--cut: 8px`; photo frames and the pass use `16px`.

**Shard edges.** Sections meet on a jagged edge instead of a straight line: the lower section's top is cut with a polygon of 5–7 points that rises and falls by 16–40px. One edge per section boundary, never decoration floating on its own.

**Offset block.** Depth is a solid UV block 6px down and 6px right behind buttons, the pass and photo frames (a pseudo-element, not `box-shadow`). Pressing a button slides it onto its block.

**Misregistration.** Display type may carry a hard `text-shadow: 0.04em 0.04em 0 var(--uv)`, no blur. Only on the hero name and the action band word.

## 5. Texture

Red fields carry print grain, like the reference: an inline SVG `feTurbulence` noise tile at 18% opacity, blended `multiply`. Black and bone fields stay clean. No scanlines, no CRT curvature, no noise on text.

## 6. Components

| Component | Spec |
| --- | --- |
| Primary button | Acid fill, void text, Chakra Petch 600, 52px tall, chamfer 8px, UV offset block. Hover: acid-deep. Press: translate 6px onto the block |
| Secondary button | Void fill, bone 2px border drawn inside the chamfer (inset outline), bone text. Hover: bone fill, void text |
| Destructive | Signal fill, bone text |
| Link | Bone, 2px acid underline offset 0.2em. Hover: acid text |
| Text field | Void-2 fill, 2px ash border, bone text, chamfer 8px. Focus: acid border plus 3px acid outline. Error: signal border, message in void on a signal strip |
| Checkbox | 24px square, acid when checked |
| Progress (wizard) | Segmented bars, chamfered: done = bone, current = acid, todo = void-3 |
| Notice | Strip with a 6px left block: acid (ok), signal (error), cyan (info) |
| Status chip | Chamfered tag. Pending = UV, Approved = acid on void, Paid = cyan on void, Declined/Rejected = signal |
| Event pass | Void-2 card, chamfer 16px, acid stripe at top, name in Big Shoulders 900, reference code in cyan, parol at top right, UV offset block |
| Countdown | Signal field + grain, digits in Big Shoulders 900 at up to 13rem in void, the seconds digit in bone (large type, 4.2 : 1), labels in Chakra Petch in void |
| Gallery | Contact sheet: up to 9 chamfered frames (first one large), the last showing "+N more" in Big Shoulders; UV offset block on hover/focus |
| Lightbox | Void, controls as secondary buttons, caption in Chakra Petch |
| Nav | Wordmark left in Big Shoulders 800, three to five plain links, Sign in. No bar background |
| Footer | Bone field, invitation in Big Shoulders, the whole name set to the width (two balanced lines on a phone, one line on wider screens), its foot cropped by the bottom edge |
| Admin | Bone work surface, void header bar, acid primary buttons, chamfered tables headers; no grain, no shards, no glitch. Readability first |

**The parol** stays: redrawn as a hard-edged shard star in acid with a bone core and a UV offset copy behind it. No glow.

## 7. Imagery

- Photos stay natural colour. Frames are chamfered with the UV offset block.
- The hero photo sits under a void scrim (the one permitted gradient: black, transparent to 92%, under text only).
- The venue video keeps its portrait frame with the same chamfer.

## 8. Motion

| Moment | Spec |
| --- | --- |
| Signature: hero glitch | On load the name appears as three copies (bone, UV, cyan) offset by up to 8px and clipped into 4 horizontal slices that jump for 450ms, then collapse onto one bone line. `transform` and `clip-path` only |
| Entrances | Section parts rise 20px and fade in, staggered 70ms, once |
| Buttons | Press slides onto the offset block (120ms) |
| Countdown | The seconds digit flips with a 2px vertical jolt each second |
| Reduced motion | No glitch, no jolt, no rise; content is simply there |

## 9. Accessibility

- Focus ring: 3px acid outline, 3px offset, on every interactive element, on every field colour (on acid fields it turns void).
- Body text never below 17px on phones; secondary text never below 14px.
- Status is never colour alone: chips always carry the word.
- Grain never sits under small text. Running text on red fields is void (black), 17px or larger.

## 10. Do and don't

| Do | Don't |
| --- | --- |
| Hard offset blocks for depth | Blurred neon glows, `box-shadow` halos |
| Shard edges between sections | Shards scattered as confetti |
| Grain on red fields | Scanlines, CRT effects, glitch on body text |
| Violet as a flat edge | Purple gradients (from the brief), glassmorphism, emoji, clip-art |
| Chakra Petch for everything readable | Monospace "HUD" labels, tiny tracked capitals |
| One glitch, on load | Looping glitches or flicker |

## 11. Exceptions to the taste-skill house rules

The reference brand needs three devices the taste house rules normally ban. They are used exactly as specified above and nowhere else:

1. **Grain texture** on red fields.
2. **Hard offset blocks** (UV) behind buttons, the pass and photo frames, and the misregistration shadow on two display lines.
3. **Shard edges** between sections and the shard parol.

## 12. Where it lands in the code

| File | Change |
| --- | --- |
| `src/app/layout.tsx` | Swap fonts to Big Shoulders + Chakra Petch |
| `src/app/globals.css` | New tokens, chamfer/offset/grain utilities, buttons, fields, focus |
| `src/app/home.module.css`, `src/app/page.tsx` | Field sequence, shard edges, glitch hero, countdown billboard |
| `src/components/*` | Pass, Parol, Countdown, Gallery, PassPreview restyled |
| `src/app/register/*`, `src/app/account/*`, `src/components/AuthShell*` | Wizard and account in the void theme |
| `src/app/admin/admin.module.css` | Bone work surface with the new accents |

No content, data or behaviour changes.
