# OpenThorn Launch Ad

Fresh 20 second Remotion ad introducing OpenThorn publicly.

- Composition: `OpenThornLaunchAd`
- Format: 1920x1080, 16:9
- Duration: 600 frames at 30fps
- Entry: `src/index.ts`

## Preview

```bash
npm run dev
```

The local Studio will open at the URL printed by Remotion. In this workspace it was verified at:

```text
http://localhost:3011
```

## Export

```bash
npm run render
```

The output path is:

```text
out/openthorn-launch-ad.mp4
```

Note: On this Windows ARM64 machine, Remotion's CLI renderer cannot complete because its bundled Chrome Headless Shell and native compositor are not available for this architecture. The composition bundles and previews in Studio; export it from an x64 Windows, macOS, or Linux environment if the local renderer reports the same platform error.
