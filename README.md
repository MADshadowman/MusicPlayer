# MusicPlayer

A self-hosted personal music player with audio visualizations and playlist
management — built with plain HTML/CSS/JS. **No build step, no npm install, no
framework.** Adapted from the same architecture as VideoPlayer: drop it on any
web host (PHP optional, none needed) and it plays your files.

## Highlights

- **Native-first playback:** MP3, AAC/M4A, FLAC, OGG (Vorbis/Opus) and WAV play
  through the browser's native `<audio>` element.
- **Real-time visualizations:** a Web Audio `AnalyserNode` drives a canvas
  visualizer with three modes — frequency bars, mirrored bars and an
  oscilloscope wave — tinted by your chosen accent color. Cycle modes with `V`.
- **Playlist management:** create/delete playlists (saved in localStorage), add
  tracks from the `+` button on any card, remove from playlist detail view, and
  fire up any playlist in one click.
- **Queue controls:** shuffle, repeat (off / all / one), "play next in queue",
  autoplay continuation — persisted across sessions.
- **Auto-discovering library:** `tracks/tracks.json` manifest → directory
  listing fallback → client-side **Open Folder** import (with cover-art
  matching per folder and `Artist - Title` filename parsing).
- **Automatic metadata hydration:** duration is probed per file and filled into
  the cards.
- **Modern UI:** dark glass design, search, sorting (title/artist/album/
  length/date), MediaSession lock-screen controls, keyboard shortcuts, fully
  responsive from phones to widescreen.

## Quick start

```bash
# from the repo root
node tools/serve.mjs 8080
# open http://localhost:8080
```

Then put audio files in `tracks/`. That's the whole setup — the dev server is a
tiny zero-dependency Node script with HTTP range support; any static file
server with range support works too.

### Library sources

1. `tracks/tracks.json` or `tracks.json` manifest (optional, but enables
   explicit metadata: title, artist, album, genre, art, duration)
2. Directory index parsing (`tracks/`) if the host exposes listings
3. The **Open Folder** button — client-side folder import, works offline and
   from `file://`

### Manifest format

```json
{
  "tracks": [
    {
      "id": "nightride",
      "title": "Nightride",
      "artist": "Synthia",
      "album": "Neon Drive",
      "src": "nightride.mp3",
      "art": "cover.jpg",
      "duration": 214
    }
  ]
}
```

### Folder import conventions

- Cover art: any image inside the track's folder (files named `cover`, `album`,
  `folder`, or `front` win) is shown as the animated pulsing art.
- `Artist - Title.mp3` filenames are parsed into separate artist/title.
- `folder/Artist/Album/track.mp3` paths are parsed from the subdirectory names.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Seek ±5 s |
| `↑` / `↓` | Volume ±5% |
| `N` / `P` | Next / previous track |
| `S` | Shuffle |
| `R` | Repeat: off → all → one |
| `V` | Cycle visualizer (bars → mirrored → wave → off) |
| `M` | Mute |
| `/` | Focus search |
| `?` | Shortcut help |

## Structure

```text
MusicPlayer/
  index.html
  styles.css
  app.js
  tools/serve.mjs
  tracks/
    your-track.mp3
    cover.jpg
    tracks.json
```

## Notes

- Visualizations require playing from HTTP rather than `file://` for remote
  sources, because Web Audio analysis needs clean same-origin/CORS access.
  Locally imported files (Open Folder) work everywhere.
- `MediaElementSource` means one `<audio>` element drives both playback and the
  analyser — the graph is created lazily on first play (browser autoplay
  policy friendly).
- Playlists and preferences live in `localStorage`; the manifest remains the
  source of truth for the moral library.

## License

[MIT](LICENSE)
