# Claude Instructions — test_website project

This file contains standing instructions for Claude to follow in this project.
It is a living document — append new learnings as tools, skills, and patterns are discovered.

---

## Video Creation with Remotion

### When the user asks to create a video, always read this section first.

### What is Remotion
Remotion is a framework for creating videos programmatically using React. Videos are
defined as React components where time is driven by `useCurrentFrame()` and
`useVideoConfig()`. It renders frame-by-frame to produce MP4 or other video formats.

### Skill: remotion-dev/skills
The project has access to the `remotion-dev/skills` package (added via `npx skills add remotion-dev/skills`).
**Always use this skill when generating Remotion video code.** Invoke it through the Skill tool
before writing any Remotion components.

Status: skill registered, pending Node.js install to activate.

---

### Remotion Project Setup (standard flow)

```bash
# Create a new Remotion project
npx create-video@latest

# Or add Remotion to an existing project
npm install remotion @remotion/cli

# Preview in browser
npx remotion studio

# Render to MP4
npx remotion render src/index.ts MyComposition out/video.mp4
```

---

### Core Remotion Concepts to follow

1. **`useCurrentFrame()`** — returns the current frame number (0-indexed). Use this to
   drive all animations.

2. **`useVideoConfig()`** — returns `{ width, height, fps, durationInFrames }`.
   Always use `fps` for time calculations instead of hardcoding.

3. **`interpolate(frame, [from, to], [outputFrom, outputTo], options)`** — the primary
   animation primitive. Always pass `{ extrapolateRight: 'clamp' }` unless intentional.

4. **`spring({ frame, fps, config })`** — physics-based animation. Prefer over
   `interpolate` for entrance/exit transitions to feel natural.

5. **`<Sequence from={N} durationInFrames={M}>`** — offset a child component so it
   starts at frame N. Use for timing multiple elements.

6. **`<AbsoluteFill>`** — full-size absolutely positioned container. Use as the root
   of every composition.

7. **`<Audio>`, `<Video>`, `<Img>`, `<OffthreadVideo>`** — Remotion-native media
   components. Never use plain `<img>` or `<video>` tags in Remotion code.

---

### Composition Registration

Every video must be registered in the root file (`src/index.ts` or `src/Root.tsx`):

```tsx
import { Composition } from 'remotion';
import { MyScene } from './MyScene';

export const RemotionRoot = () => (
  <>
    <Composition
      id="MyScene"
      component={MyScene}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
```

---

### Default video spec (use unless user specifies otherwise)

| Property        | Default         |
|-----------------|-----------------|
| fps             | 30              |
| width           | 1920            |
| height          | 1080            |
| durationInFrames| 150 (5 seconds) |
| format          | mp4             |

---

### Everair brand tokens (for any Everair product videos)

| Token        | Value     |
|--------------|-----------|
| Primary blue | `#5B5CF6` |
| Dark blue    | `#4444D4` |
| Light blue   | `#EEEEFF` |
| Dark bg      | `#0D0D14` |
| Text         | `#1A1A2E` |
| Muted        | `#6B7280` |
| Font         | Inter / system-ui |
| Logo file    | `/Users/sakshiborah/Desktop/Screenshot 2026-02-18 at 1.44.06 PM.png` |

---

### Rules to always follow

- Always look up this file before starting any video task.
- Always use the `remotion-dev/skills` skill if available before writing Remotion code.
- Never hardcode pixel values for timing — derive from `fps` and `useVideoConfig()`.
- Always clamp `interpolate` calls unless intentional overshoot is needed.
- Keep each scene as its own component file. Compose them in a root file.
- When creating Everair videos, use the brand tokens above and reference the logo.
- After completing a video task, append any new patterns or learnings to this file.

---

## Learnings log

| Date       | Learning |
|------------|----------|
| 2026-03-06 | `npx` / Node.js not installed on this machine — must install before running any Remotion commands. |
| 2026-03-06 | `remotion-dev/skills` registered as a skill for this project. |
