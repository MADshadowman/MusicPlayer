"use strict";

const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "flac", "ogg", "oga", "opus", "wav", "weba", "m4b"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const MANIFEST_CANDIDATES = ["tracks/tracks.json", "tracks.json"];
const METADATA_PROBE_CONCURRENCY = 3;
const MEDIA_SESSION_SUPPORTED =
  "mediaSession" in navigator && "MediaMetadata" in window;

const VIZ_MODES = [
  { key: "butterchurn", name: "MilkDrop" },
  { key: "aurora", name: "Aurora" },
  { key: "spectrum", name: "Spectrum" },
  { key: "nebula", name: "Nebula" },
  { key: "tunnel", name: "Tunnel" },
];

const BUTTERCHURN_LIBS = [
  "https://cdn.jsdelivr.net/npm/butterchurn@2.6.7/lib/butterchurn.min.js",
  "https://unpkg.com/butterchurn@2.6.7/lib/butterchurn.min.js",
];
const BUTTERCHURN_PRESET_LIBS = [
  "https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresets.min.js",
  "https://unpkg.com/butterchurn-presets@2.4.7/lib/butterchurnPresets.min.js",
];
/* user's reviewed keepers (matched case-insensitively by fragment) */
/* user's reviewed keepers (matched case-insensitively by fragment) */
const BUTTERCHURN_CURATE = [
  // round 1
  "canvas mix",
  "astral projection",
  "predator-prey-spirals",
  "surface turbulence",
  "liquid arrows",
  "artifact 01",
  "hurricane nightmare (moebius",
  "hurricane nightmare (gold",
  "witchcraft 2.0",
  "mindblob graffiti",
  "angel flight",
  "castle in the air",
  "high speed",
  "enterstate",
  // round 2
  "no one cares",
  "mashup (197",
  "mashup (158",
  "mashup (444",
  "hd in milk",
  "painterly tendrils",
  "calm)",
  "emergent",
  "glowsticks v2 03",
  "pogo-cubes on tokamak",
  "supraschismatika",
  "alien fader",
  "alien fish pond",
  "area 51",
  "reality tunnel",
  "3 layers",
  "bipolar 2",
  "painterly 2",
  "feedback 2",
  "bombyx mori",
  "beast mandala",
  "mandala_chasers",
  "fractaldrop",
  "rewop",
  "witchcraft (grow",
  "witchcraft (necromancer",
  "beat explorer",
  "color strike",
  "in da mash 12a",
  "martins pond",
  "city of shadows",
  "sunset over the river",
];
const BUTTERCHURN_MAX_PRESETS = 13;
const BUTTERCHURN_EXTRA_LIBS = [
  [
    "https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra.min.js",
    "https://unpkg.com/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra.min.js",
  ],
  [
    "https://cdn.jsdelivr.net/npm/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra2.min.js",
    "https://unpkg.com/butterchurn-presets@2.4.7/lib/butterchurnPresetsExtra2.min.js",
  ],
];

const SORT_OPTIONS = [
  { value: "default", label: "Natural order" },
  { value: "title-asc", label: "Title A→Z" },
  { value: "title-desc", label: "Title Z→A" },
  { value: "artist-asc", label: "Artist" },
  { value: "duration-asc", label: "Shortest" },
  { value: "duration-desc", label: "Longest" },
  { value: "date-desc", label: "Newest" },
];

const state = {
  tracks: [],
  albums: [],
  queue: [],
  queuePos: -1,
  bcAutoCycle: true,
  queuePos: -1,
  playedHistory: [],
  shuffle: false,
  repeat: "off",
  autoplayNext: true,
  boostEnabled: false,
  volume: 1,
  muted: false,
  theme: "dark",
  accent: "teal",
  vizIndex: 0,
  bcPresetIndex: 0,
  bcAutoCycle: false,
  vizReact: 0.55,
  queueContextId: "",
  sortKey: "default",
  vizOpen: false,
  searchTerm: "",
  view: "home",
  viewId: null,
  librarySource: "Unknown",
  localObjectUrls: [],
  playlistsCache: null,
  nowPlayingId: null,
};

const refs = {
  body: document.body,
  audio: null,
  navItems: [...document.querySelectorAll(".nav-item")],
  navPlaylists: document.getElementById("navPlaylists"),
  newPlaylistBtn: document.getElementById("newPlaylistBtn"),
  pickFolderBtn: document.getElementById("pickFolderBtn"),
  reloadLibraryBtn: document.getElementById("reloadLibraryBtn"),
  helpBtn: document.getElementById("helpBtn"),
  helpDialog: document.getElementById("helpDialog"),
  helpCloseBtn: document.getElementById("helpCloseBtn"),
  content: document.getElementById("content"),
  view: document.getElementById("view"),
  searchInput: document.getElementById("searchInput"),
  navToggle: document.getElementById("navToggle"),
  sortSelect: null,
  resultCount: document.getElementById("resultCount"),
  pbArt: document.getElementById("pbArt"),
  pbTitle: document.getElementById("pbTitle"),
  pbArtist: document.getElementById("pbArtist"),
  pbAddBtn: document.getElementById("pbAddBtn"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  shuffleBtn: document.getElementById("shuffleBtn"),
  repeatBtn: document.getElementById("repeatBtn"),
  muteBtn: document.getElementById("muteBtn"),
  volumeSlider: document.getElementById("volumeSlider"),
  seekSlider: document.getElementById("seekSlider"),
  currentTimeLabel: document.getElementById("currentTimeLabel"),
  totalTimeLabel: document.getElementById("totalTimeLabel"),
  vizOpenBtn: document.getElementById("vizOpenBtn"),
  vizLayer: document.getElementById("vizLayer"),
  vizCanvas: document.getElementById("vizCanvas"),
  vizCloseBtn: document.getElementById("vizCloseBtn"),
  vizName: document.getElementById("vizName"),
  vizDots: document.getElementById("vizDots"),
  vizInfo: document.getElementById("vizInfo"),
  vizTrackTitle: document.getElementById("vizTrackTitle"),
  vizTrackArtist: document.getElementById("vizTrackArtist"),
  vizTransport: document.getElementById("vizTransport"),
  vizPrevBtn: document.getElementById("vizPrevBtn"),
  vizPlayPauseBtn: document.getElementById("vizPlayPauseBtn"),
  vizNextBtn: document.getElementById("vizNextBtn"),
  vizSeekSlider: document.getElementById("vizSeekSlider"),
  vizCurTime: document.getElementById("vizCurTime"),
  vizTotTime: document.getElementById("vizTotTime"),
  miniViz: document.getElementById("miniViz"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsDialog: document.getElementById("settingsDialog"),
  settingsCloseBtn: document.getElementById("settingsCloseBtn"),
  newPlaylistDialog: document.getElementById("newPlaylistDialog"),
  newPlaylistName: document.getElementById("newPlaylistName"),
  newPlaylistForm: document.getElementById("newPlaylistForm"),
  vizPresetSelect: document.getElementById("vizPresetSelect"),
  themeSelect: document.getElementById("themeSelect"),
  accentSelect: document.getElementById("accentSelect"),
  autoplayToggle: document.getElementById("autoplayToggle"),
  boostToggle: document.getElementById("boostToggle"),
  folderInput: document.getElementById("folderInput"),
  trackRowTemplate: document.getElementById("trackRowTemplate"),
  addMenu: document.getElementById("addMenu"),
  toastStack: document.getElementById("toastStack"),
};

const playerState = {
  duration: 0,
  currentTime: 0,
  paused: true,
};

let audioContext = null;
let sourceNode = null;
let analyser = null;
let volumeGain = null;
let boostGain = null;
let featureFreq = null;
let featureTmp = null;
let featureState = null;
const features = {
  bass: 0,
  lowMid: 0,
  mid: 0,
  high: 0,
  rms: 0,
  flux: 0,
  beat: 0,
  beatCount: 0,
  color: 0.5,
};
let lastFeatureTime = 0;
let vizRAF = 0;
let menuAnchor = null;
let lastPositionStateWrite = 0;
let renderTimer = 0;
const artCache = new Map();

bootstrap();

/* ============================================================
   Bootstrap & preferences
   ============================================================ */

function bootstrap() {
  try {
    createAudioElement();
    bindEvents();
    hydratePreferences();
    initMediaSessionHandlers();
    loadLibrary();
  } catch (error) {
    console.error("bootstrap failed", error);
    showToast(`Startup error: ${error?.message || error}`);
  }
}

function createAudioElement() {
  const audio = document.createElement("audio");
  audio.preload = "metadata";
  audio.crossOrigin = "anonymous";
  audio.addEventListener("loadedmetadata", onAudioLoadedMetadata);
  audio.addEventListener("timeupdate", onAudioTimeUpdate);
  audio.addEventListener("ended", onAudioEnded);
  audio.addEventListener("play", onAudioPlay);
  audio.addEventListener("pause", onAudioPause);
  audio.addEventListener("error", onAudioError);
  document.body.appendChild(audio);
  audio.style.display = "none";
  refs.audio = audio;
}

function onAudioLoadedMetadata() {
  playerState.duration = Number.isFinite(refs.audio.duration) ? refs.audio.duration : 0;
  syncPlaybackUI();
}

function onAudioTimeUpdate() {
  playerState.currentTime = refs.audio.currentTime;
  syncPlaybackUI();
  syncMediaSessionState();
}

function onAudioPlay() {
  setPlaying(true);
}

function onAudioPause() {
  setPlaying(false);
}

function onAudioEnded() {
  if (state.repeat === "one") {
    refs.audio.currentTime = 0;
    playCurrent();
    return;
  }
  const atEnd = state.queuePos >= state.queue.length - 1;
  const willContinue = state.autoplayNext && (!atEnd || state.repeat === "all" || state.shuffle);
  if (willContinue) {
    pushHistory(state.queuePos);
    playNext();
    return;
  }
  setPlaying(false);
}

function onAudioError(event) {
  const error = event.currentTarget?.error;
  if (error && error.code !== MediaError.MEDIA_ERR_ABORTED) {
    showToast(`Audio error: ${error.message || "unknown"}`);
  }
}

function hydratePreferences() {
  const themes = ["auto", "dark", "light"];
  const savedTheme = localStorage.getItem("mp_theme");
  state.theme = themes.includes(savedTheme) ? savedTheme : "dark";
  const accents = ["default", "amber", "teal", "blue", "rose", "violet"];
  const savedAccent = localStorage.getItem("mp_accent");
  state.accent = accents.includes(savedAccent) ? savedAccent : "teal";
  refs.themeSelect.value = state.theme;
  refs.accentSelect.value = state.accent;
  applyTheme();

  const savedViz = localStorage.getItem("mp_viz_mode");
  const vizPos = VIZ_MODES.findIndex((p) => p.key === savedViz);
  state.vizIndex = vizPos >= 0 ? vizPos : 0;
  refs.vizPresetSelect.innerHTML = VIZ_MODES.map(
    (p) => `<option value="${p.key}">${p.name}</option>`
  ).join("");
  refs.vizPresetSelect.value = VIZ_MODES[state.vizIndex].key;
  const savedBc = Number(localStorage.getItem("mp_bc_preset") || "0");
  state.bcPresetIndex = Number.isFinite(savedBc) ? Math.max(0, savedBc) : 0;
  const savedReact = Number(localStorage.getItem("mp_viz_react") || "0.55");
  state.vizReact = Number.isFinite(savedReact) ? clamp(savedReact, 0.05, 1) : 0.55;
  state.bcAutoCycle = localStorage.getItem("mp_bc_auto") === "1";

  state.sortKey = localStorage.getItem("mp_sort") || "default";
  if (!SORT_OPTIONS.some((o) => o.value === state.sortKey)) state.sortKey = "default";

  state.autoplayNext = localStorage.getItem("mp_autoplay_next") !== "0";
  refs.autoplayToggle.checked = state.autoplayNext;
  state.boostEnabled = localStorage.getItem("mp_volume_boost") === "1";
  refs.boostToggle.checked = state.boostEnabled;
  state.shuffle = localStorage.getItem("mp_shuffle") === "1";
  const savedRepeat = localStorage.getItem("mp_repeat");
  state.repeat = ["off", "all", "one"].includes(savedRepeat) ? savedRepeat : "off";

  const savedVolume = Number(localStorage.getItem("mp_volume") || "1");
  state.volume = Number.isFinite(savedVolume) ? clamp(savedVolume, 0, 1) : 1;
  state.muted = localStorage.getItem("mp_muted") === "1";
  applyVolume();
  refs.volumeSlider.value = String(state.volume);
  refreshVolumeControls();
  refreshTransportControls();
}

function applyTheme() {
  const theme =
    state.theme === "auto" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : state.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = state.accent || "default";
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.content = theme === "light" ? "#f4f5f7" : "#0e0e11";
  }
}

/* ============================================================
   Library loading
   ============================================================ */

async function loadLibrary() {
  setViewMessage("Loading library\u2026");
  stopPlayback();

  state.tracks = [];
  state.albums = [];
  state.queue = [];
  state.queuePos = -1;
  state.nowPlayingId = null;
  cleanupLocalObjectUrls();
  artCache.clear();

  let tracks;
  try {
    const manifest = await fetchManifest();
    tracks = manifest.map(normalizeTrackItem).filter(Boolean);
  } catch {
    const files = await fetchDirectoryIndexFallback("tracks/");
    tracks = files.map(normalizeTrackItem).filter(Boolean);
  }

  state.tracks = tracks;
  computeAlbums();
  renderNavPlaylists();
  goToView("home");
  renderView();
  if (state.tracks.length) {
    hydrateTrackMetadataInBackground();
  }
}

async function fetchManifest() {
  const params = new URLSearchParams(window.location.search);
  const override = params.get("manifest");
  const candidates = override ? [override] : MANIFEST_CANDIDATES;

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { cache: "no-store" });
      if (!response.ok) continue;
      const data = await response.json();
      const tracks = Array.isArray(data) ? data : data?.tracks;
      if (!Array.isArray(tracks) || tracks.length === 0) {
        continue;
      }
      return tracks;
    } catch {
      // keep trying candidates
    }
  }
  throw new Error("Manifest not found");
}

async function fetchDirectoryIndexFallback(baseDir) {
  try {
    const response = await fetch(baseDir, { cache: "no-store" });
    if (!response.ok) return [];
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !contentType.includes("text/html")) return [];
    const html = await response.text();
    const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);

    const unique = new Set();
    const files = [];
    for (const href of hrefs) {
      const cleaned = href.split("?")[0].split("#")[0];
      const fileName = cleaned.split("/").pop() || "";
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      if (!AUDIO_EXTENSIONS.includes(ext)) continue;
      const src = new URL(cleaned, new URL(baseDir, window.location.href)).pathname;
      if (!unique.has(src)) {
        unique.add(src);
        files.push({ src, relativePath: decodePathPart(fileName) });
      }
    }
    return files;
  } catch {
    return [];
  }
}

function normalizeTrackItem(raw, index) {
  const src = typeof raw === "string" ? raw : raw?.src || raw?.url;
  if (!src) return null;

  const rel = typeof raw === "object" ? decodePathPart(String(raw.relativePath || "")) : "";
  const fileName = rel ? rel.split("/").pop() : src.split("/").pop() || "Unnamed";

  let title = cleanTrackName(rel || fileName);
  let artist = typeof raw === "object" && raw.artist?.trim() ? raw.artist.trim() : "";
  let album = typeof raw === "object" && raw.album?.trim() ? raw.album.trim() : "";

  const dirs = rel.split("/").filter(Boolean).slice(0, -1);
  if (!artist && dirs.length) {
    artist = decodePathPart(dirs[dirs.length - 1]);
  }
  if (!album && dirs.length >= 2) {
    album = decodePathPart(dirs[dirs.length - 2]);
  }

  const split = splitArtistTitle(title);
  if (split.artist && (!artist || artist === "Unknown artist")) {
    artist = split.artist;
    title = split.title;
  } else if (split.artist && split.artist !== artist && dirs.length === 0) {
    artist = split.artist;
    title = split.title;
  }

  return {
    id: (typeof raw === "object" && raw.id) || `track-${index + 1}`,
    title: title || fileName.replace(/\.[^.]+$/, ""),
    artist: artist || "Unknown artist",
    album: album || "",
    genre: (typeof raw === "object" && raw.genre?.trim()) || "",
    src,
    art: raw?.art || raw?.cover || "",
    duration: Number(raw?.duration) || 0,
    sizeBytes: Number(raw?.sizeBytes) || 0,
    createdAt: raw?.createdAt || "",
    localFile: raw?.file || null,
    metaLocked:
      raw instanceof String ||
      Boolean(
        (typeof raw === "object" && (raw.title?.trim() || raw.artist?.trim() || raw.album?.trim())) ||
        (typeof raw === "object" && raw.manifest === true)
      ),
    metaProbed: false,
  };
}

function decodePathPart(part) {
  if (!part.includes("%")) return part;
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function cleanTrackName(name) {
  let out = String(name)
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ");
  out = out.replace(/^(\d{1,3}[\s.\-]+)(?=\S)/, "").trim();
  return out;
}

function splitArtistTitle(title) {
  const sepMatch = title.match(/\s[-]\s(?=\S)/);
  if (!sepMatch) return { artist: "", title };
  const artist = title.slice(0, sepMatch.index).trim();
  const titleRest = title.slice(sepMatch.index + sepMatch[0].length).trim();
  if (!artist || !titleRest) return { artist: "", title };
  return { artist, title: titleRest };
}

/* ============================================================
   Album grouping
   ============================================================ */

function computeAlbums() {
  const grouped = new Map();
  for (const track of state.tracks) {
    const albumName = track.album || "Singles";
    const key = `${track.artist}::${albumName}`;
    let entry = grouped.get(key);
    if (!entry) {
      entry = { artist: track.artist, name: albumName, trackIds: [] };
      grouped.set(key, entry);
    }
    entry.trackIds.push(track.id);
  }
  state.albums = [...grouped.entries()].map(([key, entry]) => ({
    id: `album:${key}`,
    ...entry,
  }));
  state.albums.sort((a, b) => a.artist.localeCompare(b.artist) || a.name.localeCompare(b.name));
}

function getTrack(id) {
  return state.tracks.find((t) => t.id === id) || null;
}

function albumOfTrack(track) {
  const name = track.album || "Singles";
  return state.albums.find((a) => a.artist === track.artist && a.name === name) || null;
}

function artForAlbum(album) {
  if (album) {
    const first = album.trackIds.map(getTrack).find((t) => t?.art);
    if (first) return first.art;
  }
  return placeholderArt(album ? `${album.artist}::${album.name}` : "unknown");
}

function matchFilter(track) {
  const term = state.searchTerm.toLowerCase().trim();
  if (!term) return true;
  return [track.title, track.artist, track.album, track.genre]
    .join(" ")
    .toLowerCase()
    .includes(term);
}

function placeholderArt(seed, size = 320) {
  const cached = artCache.get(seed);
  if (cached) return cached;

  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hue = hash % 360;
  const hue2 = (hue + 40 + (hash % 50)) % 360;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const grad = ctx.createLinearGradient(0, size, size, 0);
  grad.addColorStop(0, `hsl(${hue} 55% 25%)`);
  grad.addColorStop(1, `hsl(${hue2} 50% 14%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = size * 0.015;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(
      size * (0.32 + (hash % 27) / 110),
      size * (0.36 + ((hash >> 5) % 23) / 130),
      size * (0.14 + i * 0.09),
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.arc(size * 0.62, size * 0.44, size * 0.05, 0, Math.PI * 2);
  ctx.fill();

  const url = canvas.toDataURL("image/png");
  artCache.set(seed, url);
  return url;
}

/* ============================================================
   Playback / Web Audio
   ============================================================ */

function ensureAudioGraph() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  if (!sourceNode && refs.audio) {
    sourceNode = audioContext.createMediaElementSource(refs.audio);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;
    volumeGain = audioContext.createGain();
    boostGain = audioContext.createGain();
    applyBoost();
    applyVolume();
    sourceNode.connect(analyser);
    analyser.connect(volumeGain);
    volumeGain.connect(boostGain);
    boostGain.connect(audioContext.destination);
    featureFreq = new Float32Array(analyser.frequencyBinCount);
    featureTmpUint8 = new Uint8Array(analyser.frequencyBinCount);
    featureTmp = new Float32Array(analyser.frequencyBinCount);
    featureState = {
      bandTargets: new Float32Array(BANDS.length),
      bandEnv: new Float32Array(BANDS.length),
      prevSpectrum: new Float32Array(BANDS.length),
      fluxHistory: [],
      rmsAvg: 0,
      lastOnset: 0,
    };
  }
}

/* frequency bands for the feature engine (Hz, log-ish aesthetic split) */
const BANDS = [
  { name: "sub", lo: 20, hi: 120 },
  { name: "bass", lo: 120, hi: 350 },
  { name: "lowMid", lo: 350, hi: 900 },
  { name: "mid", lo: 900, hi: 2400 },
  { name: "high", lo: 2400, hi: 8000 },
  { name: "air", lo: 8000, hi: 16000 },
];

/* time constants (seconds) — per-band attack/release smoothing */
const BAND_ENV = [
  { attack: 0.05, release: 0.22 },
  { attack: 0.05, release: 0.25 },
  { attack: 0.06, release: 0.28 },
  { attack: 0.07, release: 0.3 },
  { attack: 0.08, release: 0.32 },
  { attack: 0.1, release: 0.38 },
];

const BAND_WEIGHT = [1.15, 1.1, 1.0, 0.95, 0.9, 0.85];

function applyVolume() {
  const level = state.muted ? 0 : state.volume;
  if (volumeGain && audioContext) volumeGain.gain.value = level;
  if (refs.audio) {
    refs.audio.volume = 1;
    refs.audio.muted = false;
  }
}

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

function applyBoost() {
  if (boostGain) boostGain.gain.value = state.boostEnabled ? 2 : 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function syncRangeFill(input) {
  if (!input) return;
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const value = Number(input.value) || 0;
  input.style.setProperty("--fill", `${((value - min) / (max - min)) * 100}%`);
}

function ensureQueueFromIds(trackIds, startTrackId = null, contextId = "") {
  const ids = (trackIds || []).filter((id) => getTrack(id));
  if (!ids.length) return;
  state.queue = ids.map((id) => ({ id }));
  const pos = startTrackId ? state.queue.findIndex((e) => e.id === startTrackId) : 0;
  state.queuePos = pos >= 0 ? pos : 0;
  state.playedHistory = [];
  state.queueContextId = contextId;
}

function ensureQueueFromAll(startTrackId) {
  ensureQueueFromIds(
    state.tracks.filter(matchFilter).map((t) => t.id),
    startTrackId,
    "all"
  );
}

function ensureQueueFromPlaylist(playlist, startTrackId = null) {
  const ids = playlist.trackIds.filter((id) => getTrack(id));
  if (!ids.length) {
    ensureQueueFromAll(startTrackId);
    return;
  }
  ensureQueueFromIds(ids, startTrackId, playlist.id);
}

async function playQueueIndex(pos, options = {}) {
  const entry = state.queue[pos];
  if (!entry) return;
  state.queuePos = pos;
  state.nowPlayingId = entry.id;
  const track = getTrack(entry.id);
  if (!track) return;

  refreshNowPlayingUI(track);
  if (track.localFile) {
    const url = URL.createObjectURL(track.localFile);
    trackLocalObjectUrl(url);
    refs.audio.src = url;
  } else {
    refs.audio.src = track.src;
  }
  updateMediaSessionMetadata(track);
  renderNavPlaylists();
  updateActiveRow();
  if (options.autoplay !== false) {
    await playCurrent();
  }
}

function playCurrent() {
  if (!refs.audio || !refs.audio.src) {
    showToast("Select a track first");
    return Promise.resolve();
  }
  ensureAudioGraph();
  return refs.audio.play().catch((error) => {
    setPlaying(false);
    showToast(`Playback failed: ${error?.message || error}`);
  });
}

function pauseCurrent() {
  refs.audio.pause();
}

function togglePlayback() {
  if (playerState.paused) playCurrent();
  else pauseCurrent();
}

function playNext() {
  if (state.queuePos < 0) return;
  if (state.repeat === "one" && state.queue.length) {
    refs.audio.currentTime = 0;
    playCurrent().catch(() => {});
    return;
  }
  const atEnd = state.queuePos >= state.queue.length - 1;
  if (atEnd && state.repeat === "off") {
    setPlaying(false);
    return;
  }
  let nextPos;
  if (state.shuffle && state.queue.length > 1) {
    do {
      nextPos = Math.floor(Math.random() * state.queue.length);
    } while (nextPos === state.queuePos);
  } else {
    nextPos = atEnd ? 0 : state.queuePos + 1;
  }
  pushHistory(state.queuePos);
  playQueueIndex(nextPos, { autoplay: true });
}

function playPrevious() {
  if (state.queuePos < 0) return;
  if (playerState.currentTime > 3) {
    refs.audio.currentTime = 0;
    return;
  }
  if (state.playedHistory.length) {
    const prevPos = state.playedHistory.pop();
    state.queuePos = prevPos;
    playQueueIndex(prevPos, { autoplay: true });
    return;
  }
  const prevPos = Math.max(0, state.queuePos - 1);
  state.queuePos = prevPos;
  playQueueIndex(prevPos, { autoplay: true });
}

function insertNextInQueue(trackId) {
  if (state.queuePos < 0) {
    state.queue = [{ id: trackId }];
    state.queuePos = 0;
    return;
  }
  const atPos = state.queue.findIndex((e) => e.id === trackId);
  if (atPos === state.queuePos + 1) return;
  if (atPos >= 0) state.queue.splice(atPos, 1);
  state.queue.splice(state.queuePos + 1, 0, { id: trackId });
}

function pushHistory(pos) {
  state.playedHistory.push(pos);
  if (state.playedHistory.length > 64) state.playedHistory.shift();
}

function stopPlayback() {
  if (refs.audio) {
    refs.audio.pause();
    refs.audio.removeAttribute("src");
    refs.audio.load();
  }
  setPlaying(false);
  state.nowPlayingId = null;
  refs.pbTitle.textContent = "No track selected";
  refs.pbArtist.textContent = "Load some music to begin";
  refs.pbArt.innerHTML = "";
  refs.pbAddBtn.hidden = true;
  updateActiveRow();
}

function setPlaying(isPlaying) {
  playerState.paused = !isPlaying;
  refs.body.dataset.playing = isPlaying ? "true" : "false";
  refs.playPauseBtn.dataset.state = isPlaying ? "playing" : "paused";
  refreshVizTransport();
  for (const btn of document.querySelectorAll(".big-play-row")) {
    btn.dataset.state = isPlaying ? "playing" : "paused";
  }
  if (isPlaying) startVizLoop();
  else if (!state.vizOpen) stopVizLoop();
  syncMediaSessionState();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

const formatDuration = formatTime;

/* ============================================================
   Playbar / row syncing
   ============================================================ */

function refreshNowPlayingUI(track) {
  refs.pbTitle.textContent = track.title;
  refs.pbArtist.textContent = track.artist || "Unknown artist";
  refs.vizTrackTitle.textContent = track.title;
  refs.vizTrackArtist.textContent = track.artist || "Unknown artist";
  const art = track.art || (track.album ? placeholderArt(`${track.artist}::${track.album}`) : placeholderArt(track.id));
  refs.pbArt.innerHTML = art ? `<img src="${art}" alt="" />` : "";
  refs.pbAddBtn.hidden = !getPlaylists().length;
}

function syncPlaybackUI() {
  const duration = playerState.duration;
  const current = playerState.currentTime;
  refs.currentTimeLabel.textContent = formatTime(current);
  refs.totalTimeLabel.textContent = formatTime(duration);
  if (duration > 0) {
    refs.seekSlider.value = String(Math.round((current / duration) * 1000));
  }
  syncRangeFill(refs.seekSlider);
  syncVizSeek();
}

function updateActiveRow() {
  for (const row of refs.view.querySelectorAll(".track-row")) {
    row.classList.toggle("active", row.dataset.trackId === state.nowPlayingId);
  }
}

/* ============================================================
   Views / rendering
   ============================================================ */

function setViewMessage(html) {
  refs.view.innerHTML = `<div class="view-empty">${html}</div>`;
  refs.resultCount.textContent = "";
}

function goToView(viewName, viewId = null) {
  state.view = viewName;
  state.viewId = viewId;
  document.body.classList.remove("nav-open");
  if (viewName === "home" || viewName === "albums" || viewName === "playlists") {
    state.searchTerm = "";
    refs.searchInput.value = "";
  }
  renderNavHighlight();
  renderView();
  refs.content.scrollTop = 0;
}

function renderNavHighlight() {
  const target =
    state.view === "album" ? "albums" : state.view === "playlist" ? "playlists" : state.view;
  for (const item of refs.navItems) {
    item.setAttribute("aria-selected", String(item.dataset.nav === target));
  }
}

function renderView() {
  if (state.vizOpen) return;
  renderNavHighlight();
  if (!state.tracks.length) {
    setViewMessage(
      window.location.protocol === "file:"
        ? "No tracks yet. Use <strong>Open folder</strong> in the sidebar, or drag files anywhere onto this page."
        : "No tracks found. Drop files into <code>tracks/</code>, provide <code>tracks/tracks.json</code>, or use <strong>Open folder</strong>."
    );
    return;
  }
  switch (state.view) {
    case "albums":
      renderAlbumsView();
      break;
    case "album":
      renderAlbumDetail();
      break;
    case "playlists":
      renderPlaylistsView();
      break;
    case "playlist":
      renderPlaylistDetail();
      break;
    case "home":
    default:
      renderHomeView();
      break;
  }
  updateActiveRow();
  if (state.nowPlayingId) {
    
  }
}

function buildNode(tag, className, textContent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent != null) node.textContent = textContent;
  return node;
}

function buildHero(eyebrow, title) {
  const hero = buildNode("section", "view-hero");
  hero.appendChild(buildNode("p", "view-eyebrow", eyebrow));
  hero.appendChild(buildNode("h1", "view-title", title));
  return hero;
}

function buildSectionHeader(title, extraNode) {
  const head = buildNode("div", "section-head");
  head.appendChild(buildNode("h2", null, title));
  if (extraNode) head.appendChild(extraNode);
  return head;
}

function renderHomeView() {
  const fragment = document.createDocumentFragment();
  fragment.appendChild(buildHero("Personal music library", "Your music"));

  const stats = buildNode("div", "stat-chips");
  const trackedDuration = state.tracks.reduce((s, t) => s + (t.duration || 0), 0);
  const hoursText =
    trackedDuration >= 3600
      ? `${(trackedDuration / 3600).toFixed(1)} hr`
      : trackedDuration > 0 ? `${Math.round(trackedDuration / 60)} min` : "";
  stats.appendChild(buildNode("span", "stat-chip", `${state.tracks.length} track${state.tracks.length === 1 ? "" : "s"}`));
  stats.appendChild(buildNode("span", "stat-chip", `${state.albums.length} album${state.albums.length === 1 ? "" : "s"}`));
  if (hoursText) stats.appendChild(buildNode("span", "stat-chip", hoursText));

  const homeActions = buildNode("div", "home-actions");
  const playAllBtn = buildBigPlayButton(() => {
    ensureQueueFromAll(null);
    playQueueIndex(0, { autoplay: true });
  }, "Play all tracks", "all");
  homeActions.appendChild(playAllBtn);
  homeActions.appendChild(stats);
  fragment.appendChild(homeActions);

  const albumsToPreload = state.albums.slice(0, 10);
  if (albumsToPreload.length) {
    const seeAll = buildNode("button", "section-link");
    seeAll.type = "button";
    seeAll.textContent = "See all";
    seeAll.addEventListener("click", () => goToView("albums"));
    fragment.appendChild(buildSectionHeader("Albums", seeAll));
    fragment.appendChild(albumGrid(albumsToPreload));
  }

  const trackSection = buildNode("section");
  trackSection.appendChild(buildSectionHeader("All tracks"));
  trackSection.appendChild(trackList(state.tracks.filter(matchFilter)));
  fragment.appendChild(trackSection);

  refs.view.innerHTML = "";
  refs.view.appendChild(fragment);
  const matching = state.tracks.filter(matchFilter).length;
  refs.resultCount.textContent = `track${matching === 1 ? "" : "s"}: ${matching}`;
}

function albumGrid(albums) {
  const grid = buildNode("div", "album-grid");
  for (const album of albums) {
    const card = buildNode("button", "album-card");
    card.type = "button";
    card.innerHTML = `
      <div class="album-art-wrap">
        <img class="album-art" alt="" loading="lazy" />
        <span class="album-playbadge"><svg aria-hidden="true"><use href="#i-play" /></svg></span>
      </div>
      <p class="album-name"></p>
      <p class="album-artist"></p>`;
    card.querySelector(".album-art").src = artForAlbum(album);
    card.querySelector(".album-art").alt = `${album.name} cover`;
    card.querySelector(".album-name").textContent = album.name;
    card.querySelector(".album-artist").textContent = album.artist;
    card.addEventListener("click", () => goToView("album", album.id));
    grid.appendChild(card);
  }
  return grid;
}

function trackList(tracks) {
  const list = buildNode("div", "track-list");
  const head = buildNode("div", "track-list-head");
  head.innerHTML = `<span></span><span class="th">Track</span><span class="th-sort"></span>`;
  head.querySelector(".th-sort").appendChild(buildSortSelect());
  list.appendChild(head);
  const visible = sortTracks(tracks);
  visible.forEach((track, index) => {
    list.appendChild(buildTrackRow(track, index + 1));
  });
  return list;
}

function buildSortSelect() {
  const select = buildNode("select", "sort-select");
  select.title = "Sort order";
  select.innerHTML = SORT_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
  select.value = state.sortKey;
  select.addEventListener("change", () => {
    state.sortKey = select.value;
    localStorage.setItem("mp_sort", state.sortKey);
    renderView();
  });
  return select;
}

function buildTrackRow(track, position) {
  const row = refs.trackRowTemplate.content.firstElementChild.cloneNode(true);
  row.dataset.trackId = track.id;
  row.dataset.position = String(position ?? "");
  row.querySelector(".row-idx").textContent = String(position ?? "");
  row.querySelector(".row-title").textContent = track.title;
  row.querySelector(".row-artist").textContent = track.artist || "Unknown artist";
  row.querySelector(".row-dur").textContent = track.duration ? formatTime(track.duration) : "--:--";

  row.addEventListener("click", () => playTrackInContext(track));

  row.querySelector(".row-artist").addEventListener("click", (event) => {
    event.stopPropagation();
    state.searchTerm = track.artist;
    refs.searchInput.value = track.artist;
    renderView();
  });

  row.querySelector(".row-menu").addEventListener("click", (event) => {
    event.stopPropagation();
    openRowMenu(event.currentTarget, track);
  });

  if (state.nowPlayingId === track.id) {
    row.classList.add("active");
  }
  return row;
}

function playTrackInContext(track) {
  if (state.nowPlayingId === track.id) {
    if (!playerState.paused) {
      pauseCurrent();
      return;
    }
    if (refs.audio.src) {
      playCurrent();
      return;
    }
  }
  const contextIds = currentViewContextIds();
  if (!contextIds.includes(track.id)) {
    ensureQueueFromIds(contextIds.concat(track.id), track.id);
  } else {
    ensureQueueFromIds(contextIds, track.id);
  }
  playQueueIndex(state.queue.findIndex((e) => e.id === track.id), { autoplay: true });
}

function currentViewContextIds() {
  switch (state.view) {
    case "album": {
      const album = state.albums.find((a) => a.id === state.viewId);
      const tracks = album ? album.trackIds.map((id) => getTrack(id)).filter(Boolean) : state.tracks.filter(matchFilter);
      return sortTracks(tracks).map((t) => t.id);
    }
    case "playlist": {
      const playlist = getPlaylists().find((p) => p.id === state.viewId);
      const tracks = playlist
        ? playlist.trackIds.map((id) => getTrack(id)).filter(Boolean)
        : state.tracks.filter(matchFilter);
      return sortTracks(tracks).map((t) => t.id);
    }
    case "playlists":
    default:
      return sortTracks(state.tracks.filter(matchFilter)).map((t) => t.id);
  }
}

function allIds() {
  return sortTracks(state.tracks.filter(matchFilter)).map((t) => t.id);
}

function renderAlbumsView() {
  const term = state.searchTerm.toLowerCase().trim();
  const albums = state.albums.filter((a) =>
    term ? `${a.name} ${a.artist}`.toLowerCase().includes(term) : true
  );
  const fragment = document.createDocumentFragment();
  fragment.appendChild(buildHero("Albums", albums.length ? `${albums.length} album${albums.length === 1 ? "" : "s"}` : "No albums"));
  if (albums.length) {
    fragment.appendChild(albumGrid(albums));
  } else {
    fragment.appendChild(buildNode("div", "view-empty", "Nothing matches your search."));
  }
  refs.view.innerHTML = "";
  refs.view.appendChild(fragment);
  refs.resultCount.textContent = `album${albums.length === 1 ? "" : "s"}: ${albums.length}`;
}

function renderAlbumDetail() {
  const album = state.albums.find((a) => a.id === state.viewId);
  if (!album) {
    goToView("albums");
    return;
  }
  const albumTracks = album.trackIds.map((id) => getTrack(id)).filter(Boolean);
  const visible = albumTracks.filter(matchFilter);
  refs.resultCount.textContent = `${visible.length} track${visible.length === 1 ? "" : "s"}`;
  const totalSecs = albumTracks.reduce((s, t) => s + (t.duration || 0), 0);

  const fragment = document.createDocumentFragment();
  const head = buildNode("div", "detail-head");
  const art = buildNode("div", "detail-art");
  const artImg = buildNode("img", null, "");
  artImg.src = artForAlbum(album);
  artImg.alt = "";
  art.appendChild(artImg);
  head.appendChild(art);

  const info = buildNode("div", "detail-info");
  info.appendChild(buildNode("p", "detail-eyebrow", "Album"));
  info.appendChild(buildNode("h1", "detail-name", album.name));
  info.appendChild(buildNode("p", "detail-sub", `${album.artist} | ${albumTracks.length} track${albumTracks.length === 1 ? "" : "s"} | ${formatTime(totalSecs)}`));
  head.appendChild(info);
  fragment.appendChild(head);

  const actions = buildNode("div", "detail-actions");
  const bigPlay = buildBigPlayButton(
    () => {
      ensureQueueFromIds(album.trackIds, album.trackIds[0], album.id);
      playQueueIndex(0, { autoplay: true });
    },
    "Play album",
    album.id
  );
  const shuffleAlbum = buildNode("button", "shuffle-btn-row");
  shuffleAlbum.type = "button";
  shuffleAlbum.setAttribute("aria-label", "Play a random track from this album");
  shuffleAlbum.title = "Play a random track from this album";
  shuffleAlbum.innerHTML = `<svg aria-hidden="true"><use href="#i-play-circle" /></svg><span>Play random</span>`;
  shuffleAlbum.addEventListener("click", () => {
    const shuffled = fisherYates(album.trackIds.slice());
    ensureQueueFromIds(shuffled, null);
    playQueueIndex(0, { autoplay: true });
  });
  actions.appendChild(bigPlay);
  actions.appendChild(shuffleAlbum);
  fragment.appendChild(actions);

  fragment.appendChild(trackList(visible));
  refs.view.innerHTML = "";
  refs.view.appendChild(fragment);
}

function renderPlaylistsView() {
  const playlists = getPlaylists();
  const fragment = document.createDocumentFragment();
  fragment.appendChild(buildHero("Playlists", playlists.length ? `${playlists.length} playlist${playlists.length === 1 ? "" : "s"}` : "No playlists yet"));

  if (!playlists.length) {
    const empty = buildNode("div", "view-empty");
    empty.textContent = "No playlists yet. Use the + button on any track or \u201cNew playlist\u201d in the sidebar.";
    fragment.appendChild(empty);
  } else {
    const grid = buildNode("div", "album-grid");
    for (const playlist of playlists) {
      const trackObjs = playlist.trackIds.map((id) => getTrack(id)).filter(Boolean);
      const card = buildNode("button", "album-card");
      card.type = "button";
      card.innerHTML = `
        <div class="album-art-wrap">
          <img class="album-art" alt="" loading="lazy" />
          <span class="album-playbadge"><svg aria-hidden="true"><use href="#i-play" /></svg></span>
        </div>
        <p class="album-name"></p>
        <p class="album-artist"></p>`;
      card.querySelector(".album-art").src = trackObjs[0]?.art || placeholderArt(playlist.id);
      card.querySelector(".album-art").alt = `${playlist.name} artwork`;
      card.querySelector(".album-name").textContent = playlist.name;
      card.querySelector(".album-artist").textContent = `${trackObjs.length} track${trackObjs.length === 1 ? "" : "s"}`;
      card.addEventListener("click", () => goToView("playlist", playlist.id));
      grid.appendChild(card);
    }
    fragment.appendChild(grid);
  }
  refs.view.innerHTML = "";
  refs.view.appendChild(fragment);
  refs.resultCount.textContent = `playlist${playlists.length === 1 ? "" : "s"}: ${playlists.length}`;
}

function renderPlaylistDetail() {
  const playlist = getPlaylists().find((p) => p.id === state.viewId);
  if (!playlist) {
    goToView("playlists");
    return;
  }
  const tracks = playlist.trackIds.map((id) => getTrack(id)).filter(Boolean);
  refs.resultCount.textContent = `${tracks.length} track${tracks.length === 1 ? "" : "s"}`;

  const fragment = document.createDocumentFragment();
  const head = buildNode("div", "detail-head");
  const art = buildNode("div", "detail-art");
  const artImg = buildNode("img");
  artImg.src = tracks[0]?.art || placeholderArt(playlist.id);
  artImg.alt = `${playlist.name} artwork`;
  art.appendChild(artImg);
  head.appendChild(art);

  const info = buildNode("div", "detail-info");
  info.appendChild(buildNode("p", "detail-eyebrow", "Playlist"));
  info.appendChild(buildNode("h1", "detail-name", playlist.name));
  info.appendChild(buildNode("p", "detail-sub", `${tracks.length} track${tracks.length === 1 ? "" : "s"} | ${formatTime(tracks.reduce((s, t) => s + (t.duration || 0), 0))}`));
  head.appendChild(info);
  fragment.appendChild(head);

  const actions = buildNode("div", "detail-actions");
  const bigPlay = buildBigPlayButton(
    () => {
      if (!tracks.length) return;
      ensureQueueFromPlaylist(playlist);
      playQueueIndex(0, { autoplay: true });
    },
    "Play playlist",
    playlist.id
  );
  bigPlay.disabled = !tracks.length;
  const shuffleBtn = buildNode("button", "shuffle-btn-row");
  shuffleBtn.type = "button";
  shuffleBtn.setAttribute("aria-label", "Play a random track from this playlist");
  shuffleBtn.title = "Play a random track from this playlist";
  shuffleBtn.innerHTML = `<svg aria-hidden="true"><use href="#i-play-circle" /></svg><span>Play random</span>`;
  shuffleBtn.addEventListener("click", () => {
    if (!tracks.length) return;
    const shuffledIds = fisherYates(tracks.map((t) => t.id));
    ensureQueueFromIds(shuffledIds, null);
    playQueueIndex(0, { autoplay: true });
  });
  actions.appendChild(bigPlay);
  actions.appendChild(shuffleBtn);
  fragment.appendChild(actions);

  if (!tracks.length) {
    fragment.appendChild(buildNode("div", "view-empty", "This playlist is empty (or its tracks are no longer in the library)."));
  } else {
    fragment.appendChild(trackList(tracks));
  }

  refs.view.innerHTML = "";
  refs.view.appendChild(fragment);
}

/* ============================================================
   Nav playlist rail
   ============================================================ */

function renderNavPlaylists() {
  refs.navPlaylists.innerHTML = "";
  const playlists = getPlaylists();
  const fragment = document.createDocumentFragment();
  for (const playlist of playlists) {
    const item = buildNode("button", "nav-playlist-item");
    item.type = "button";
    item.dataset.playlistId = playlist.id;
    item.title = playlist.name;
    item.innerHTML = `
      <svg aria-hidden="true"><use href="#i-queue" /></svg>
      <span class="np-name"></span>
      <span class="np-actions"></span>`;
    item.querySelector(".np-name").textContent = playlist.name;
    const actions = item.querySelector(".np-actions");
    const playBtn = buildNode("button", "np-play");
    playBtn.type = "button";
    playBtn.innerHTML = `<svg aria-hidden="true"><use href="#i-play-circle" /></svg>`;
    playBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      ensureQueueFromPlaylist(playlist);
      playQueueIndex(0, { autoplay: true });
    });
    const deleteBtn = buildNode("button", "np-delete");
    deleteBtn.type = "button";
    deleteBtn.innerHTML = `<svg aria-hidden="true"><use href="#i-trash" /></svg>`;
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      deletePlaylist(playlist.id);
      renderNavPlaylists();
    });
    actions.append(playBtn, deleteBtn);
    item.appendChild(actions);
    item.addEventListener("click", () => goToView("playlist", playlist.id));
    fragment.appendChild(item);
  }
  refs.navPlaylists.appendChild(fragment);
}

/* ============================================================
   Playlists (localStorage)
   ============================================================ */

function loadPlaylists() {
  try {
    const parsed = JSON.parse(localStorage.getItem("mp_playlists") || "[]");
    if (Array.isArray(parsed)) {
      return parsed.filter((p) => p && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.trackIds));
    }
  } catch {
    // fall through
  }
  return [];
}

function savePlaylists() {
  localStorage.setItem("mp_playlists", JSON.stringify(state.playlistsCache));
}

function getPlaylists() {
  if (!state.playlistsCache) {
    state.playlistsCache = loadPlaylists();
  }
  return state.playlistsCache;
}

function createPlaylist(name, trackIds = []) {
  const playlist = {
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || "New playlist",
    trackIds: [...trackIds],
  };
  getPlaylists().push(playlist);
  savePlaylists();
  return playlist;
}

function deletePlaylist(id) {
  const playlists = getPlaylists();
  const idx = playlists.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const [removed] = playlists.splice(idx, 1);
  savePlaylists();
  if (state.viewId === id) goToView("home");
  else if (state.view === "playlists") renderView();
  showToast(`Deleted "${removed.name}"`);
}

function addTrackToPlaylist(id, trackId) {
  const playlist = getPlaylists().find((p) => p.id === id);
  if (playlist && !playlist.trackIds.includes(trackId)) {
    playlist.trackIds.push(trackId);
    savePlaylists();
  }
}

function removeTrackFromPlaylist(id, trackId) {
  const playlist = getPlaylists().find((p) => p.id === id);
  if (playlist) {
    playlist.trackIds = playlist.trackIds.filter((tid) => tid !== trackId);
    savePlaylists();
  }
}

/* ============================================================
   Row context menu
   ============================================================ */

function openRowMenu(anchor, track) {
  closeRowMenu();
  const menu = refs.addMenu;
  menu.innerHTML = "";
  menu.hidden = false;

  menu.appendChild(buildNode("div", "menu-title", "Track"));
  menu.appendChild(buildNode("div", "menu-track", `${track.title}`));

  const queueBtn = menuButton("i-queue", "Play next in queue", () => {
    insertNextInQueue(track.id);
    closeRowMenu();
    showToast(`"${track.title}" plays next`);
  });
  menu.appendChild(queueBtn);
  menu.appendChild(buildNode("div", "menu-sep", null));

  const playlists = getPlaylists();
  if (!playlists.length) {
    menu.appendChild(buildNode("div", "menu-empty", "No playlists yet"));
  }
  for (const playlist of playlists) {
    const inside = playlist.trackIds.includes(track.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${inside ? "\u2713 " : ""}${playlist.name}`;
    btn.addEventListener("click", () => {
      if (inside) {
        removeTrackFromPlaylist(playlist.id, track.id);
        showToast(`Removed from "${playlist.name}"`);
      } else {
        addTrackToPlaylist(playlist.id, track.id);
        showToast(`Added to "${playlist.name}"`);
      }
      refreshAfterPlaylistChange(playlist.id);
      closeRowMenu();
    });
    menu.appendChild(btn);
  }

  if (playlists.length) {
    menu.appendChild(buildNode("div", "menu-sep", null));
  }
  const newPlaylistBtn = document.createElement("button");
  newPlaylistBtn.type = "button";
  newPlaylistBtn.textContent = "+ New playlist with this track";
  newPlaylistBtn.addEventListener("click", () => {
    closeRowMenu();
    promptNewPlaylist(track.id);
  });
  menu.appendChild(newPlaylistBtn);

  menuAnchor = anchor;
  const rect = anchor.getBoundingClientRect();
  const menuHeight = menu.offsetHeight;
  const top = rect.bottom + 6 + menuHeight > window.innerHeight ? rect.top - menuHeight - 6 : rect.bottom + 6;
  menu.style.top = `${Math.max(8, Math.round(top))}px`;
  menu.style.left = `${clamp(rect.left, 8, window.innerWidth - menu.offsetWidth - 8)}px`;

  window.setTimeout(() => {
    document.addEventListener("pointerdown", onMenuOutside);
  });
}

function refreshAfterPlaylistChange(playlistId) {
  renderNavPlaylists();
  if (state.view === "playlist" && state.viewId === playlistId) {
    renderPlaylistDetail();
  } else if (state.view === "playlists") {
    renderView();
  }
}

function closeRowMenu() {
  refs.addMenu.hidden = true;
  menuAnchor = null;
  document.removeEventListener("pointerdown", onMenuOutside);
}

function menuButton(icon, label, handler) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.innerHTML = `<svg aria-hidden="true"><use href="#${icon}" /></svg><span>${label}</span>`;
  btn.addEventListener("click", handler);
  return btn;
}

function onMenuOutside(event) {
  if (!menuAnchor) return;
  if (!refs.addMenu.contains(event.target) && !refs.addMenu.contains(event.target)) {
    closeRowMenu();
  }
}

function promptNewPlaylist(trackId = null) {
  refs.newPlaylistDialog.dataset.trackId = trackId || "";
  refs.newPlaylistName.value = "";
  refs.newPlaylistDialog.showModal();
  window.setTimeout(() => refs.newPlaylistName.focus(), 0);
}

/* ============================================================
   Media Session
   ============================================================ */

function initMediaSessionHandlers() {
  if (!MEDIA_SESSION_SUPPORTED) return;
  try {
    const session = navigator.mediaSession;
    session.setActionHandler("play", () => {
      if (playerState.paused) playCurrent();
    });
    session.setActionHandler("pause", () => {
      if (!playerState.paused) pauseCurrent();
    });
    session.setActionHandler("previoustrack", () => playPrevious());
    session.setActionHandler("nexttrack", () => playNext());
    session.setActionHandler("seekbackward", (details) => {
      const fallback = typeof details?.seekOffset === "number" ? details.seekOffset : 5;
      refs.audio.currentTime = Math.max(0, refs.audio.currentTime - fallback);
    });
    session.setActionHandler("seekforward", (details) => {
      const fallback = typeof details?.seekOffset === "number" ? details.seekOffset : 5;
      refs.audio.currentTime = Math.min(playerState.duration || Number.MAX_SAFE_INTEGER, refs.audio.currentTime + fallback);
    });
    try {
      session.setActionHandler("seekto", (details) => {
        if (typeof details?.seekTime === "number" && Number.isFinite(details.seekTime)) {
          refs.audio.currentTime = clamp(details.seekTime, 0, playerState.duration || details.seekTime);
        }
      });
    } catch {
      // seekto not supported
    }
  } catch (error) {
    console.warn("MediaSession handlers unavailable", error);
  }
}

function updateMediaSessionMetadata(track) {
  if (!MEDIA_SESSION_SUPPORTED) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || "Unknown artist",
      album: track.album || "MusicPlayer",
      artwork: track.art ? [{ src: track.art, sizes: "512x512" }] : [],
    });
  } catch {
    // ignore
  }
}

function syncMediaSessionState() {
  if (!MEDIA_SESSION_SUPPORTED) return;
  try {
    navigator.mediaSession.playbackState = playerState.paused ? "paused" : "playing";
    const duration = playerState.duration;
    const now = Date.now();
    if (
      duration > 0 &&
      now - lastPositionStateWrite > 500 &&
      typeof navigator.mediaSession.setPositionState === "function"
    ) {
      lastPositionStateWrite = now;
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: clamp(playerState.currentTime, 0, duration),
      });
    }
  } catch {
    // fine
  }
}

/* ============================================================
   Folder import, drag & drop, local library adoption
   ============================================================ */

async function onPickFolderClick() {
  if (window.showDirectoryPicker && window.isSecureContext) {
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      const entries = await collectDirEntries(handle);
      if (!entries.length) {
        setViewMessage("Folder selected, but no audio files were found.");
        return;
      }
      await adoptLocalLibrary(buildLibraryFromFileList(entries));
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      showToast(`Folder import failed: ${error?.message || error}`);
      return;
    }
  }
  refs.folderInput.click();
}

async function onFolderInputChange(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  cleanupLocalObjectUrls();
  const entries = files.map((file) => ({
    file,
    relativePath: file.webkitRelativePath || file.name,
  }));
  await adoptLocalLibrary(buildLibraryFromFileList(entries));
  event.target.value = "";
}

async function collectDirEntries(rootHandle) {
  const entries = [];
  const walk = async (handle, prefix = "") => {
    for await (const [name, entry] of handle.entries()) {
      const next = prefix ? `${prefix}/${name}` : name;
      if (entry.kind === "directory") {
        await walk(entry, next);
      } else if (entry.kind === "file") {
        entries.push({ file: await entry.getFile(), relativePath: next });
      }
    }
  };
  await walk(rootHandle, "");
  return entries;
}

async function onDocumentDrop(event) {
  event.preventDefault();
  const items = Array.from(event.dataTransfer?.items || []);
  if (!items.length) return;

  const imported = [];
  const plainFiles = [];
  for (const item of items) {
    if (item.kind !== "file") continue;
    const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
    if (entry) {
      await walkFsEntry(entry, "", imported, entry.name);
    } else {
      const file = item.getAsFile();
      if (file) plainFiles.push(file);
    }
  }
  const fileList = [
    ...imported,
    ...plainFiles.map((file) => ({ file, relativePath: file.name })),
  ];
  if (!fileList.length) return;

  cleanupLocalObjectUrls();
  const tracks = buildLibraryFromFileList(fileList);
  if (!tracks.length) {
    showToast("No audio files found in the dropped items.");
    return;
  }
  await adoptLocalLibrary(tracks);
}

async function walkFsEntry(entry, prefix, rootItems, forcedRelativePath) {
  if (!entry) return;
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    const relativePath = forcedRelativePath || (prefix ? `${prefix}/${entry.name}` : entry.name);
    rootItems.push({ file, relativePath });
    return;
  }
  if (!entry.isDirectory) return;
  const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
  const reader = entry.createReader();
  for (;;) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) break;
    for (const child of batch) {
      await walkFsEntry(child, nextPrefix, rootItems);
    }
  }
}

function buildLibraryFromFileList(entries) {
  const audioEntries = entries.filter((entry) => {
    const ext = (entry.relativePath.split(".").pop() || "").toLowerCase();
    return AUDIO_EXTENSIONS.includes(ext);
  });
  if (!audioEntries.length) return [];

  const imageEntries = entries.filter((entry) => {
    const ext = (entry.relativePath.split(".").pop() || "").toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  });
  const artForDir = new Map();
  const findDirArt = (dir) => {
    if (artForDir.has(dir)) return artForDir.get(dir);
    const inDir = imageEntries.filter((entry) => {
      const path = String(entry.relativePath).replace(/\\/g, "/");
      return (path.split("/").slice(0, -1).join("/")) === dir;
    });
    const best =
      inDir.find((item) => /cover|folder|album|front/i.test(item.relativePath)) || inDir[0];
    const url = best ? URL.createObjectURL(best.file) : "";
    if (url) trackLocalObjectUrl(url);
    artForDir.set(dir, url);
    return url;
  };

  const records = audioEntries.map((entry, index) => {
    const relative = decodePathPart(String(entry.relativePath).replace(/\\/g, "/"));
    const fileName = relative.split("/").pop() || "";
    const dirs = relative.split("/").filter(Boolean).slice(0, -1);
    const baseTitle = cleanTrackName(fileName);
    const split = splitArtistTitle(baseTitle);
    const guessedArtistFolder = dirs.length >= 2 ? decodePathPart(dirs[dirs.length - 2]) : "";
    const guessedAlbumFolder = dirs.length ? decodePathPart(dirs[dirs.length - 1]) : "";

    return {
      id: `local-${index}-${cleanId(fileName)}`,
      title: split.title || baseTitle,
      artist: split.artist || guessedArtistFolder || "Unknown artist",
      album: guessedAlbumFolder,
      src: trackLocalObjectUrl(URL.createObjectURL(entry.file)),
      art: findDirArt(dirs.join("/")),
      duration: 0,
      sizeBytes: entry.file.size || 0,
      createdAt: new Date(entry.file.lastModified || Date.now()).toISOString().slice(0, 10),
      localFile: entry.file,
    };
  });

  return records.sort((a, b) => a.title.localeCompare(b.title));
}

function cleanId(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function adoptLocalLibrary(tracks) {
  stopPlayback();
  state.tracks = tracks;
  computeAlbums();
  state.queue = [];
  state.queuePos = -1;
  state.librarySource = "Local folder";
  renderNavPlaylists();
  goToView("home");
  renderView();
  showToast(`Imported ${state.tracks.length} track${state.tracks.length === 1 ? "" : "s"}`);
  hydrateTrackMetadataInBackground();
}

function trackLocalObjectUrl(url) {
  state.localObjectUrls.push(url);
  return url;
}

function cleanupLocalObjectUrls() {
  for (const url of state.localObjectUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
  state.localObjectUrls = [];
}

/* ============================================================
   Metadata probing
   ============================================================ */

async function hydrateTrackMetadataInBackground() {
  const pending = state.tracks.filter((t) => !t.metaProbed);
  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const track = pending[cursor];
      cursor += 1;
      let blobProbeUrl = "";
      try {
        if (track.duration === 0) {
          blobProbeUrl = track.src || (track.localFile ? URL.createObjectURL(track.localFile) : "");
          const duration = await probeAudioDuration(blobProbeUrl);
          if (duration > 0) track.duration = duration;
        }
        let tags = null;
        try {
          tags = await readTrackTags(track.localFile || track.src);
        } catch {
          tags = null;
        }
        if (tags) {
          track.metaProbed = true;
          applyTagMetadata(track, tags);
        }
        scheduleRender();
      } catch {
        // ignore unsupported files
      } finally {
        if (blobProbeUrl.startsWith("blob:")) URL.revokeObjectURL(blobProbeUrl);
      }
    }
  };
  await Promise.all(Array.from({ length: METADATA_PROBE_CONCURRENCY }, () => worker()));
}

function applyTagMetadata(track, tags) {
  let changed = false;
  const artUrl = tagsArtToUrl(tags);
  if (artUrl && !track.art) {
    track.art = artUrl;
    trackLocalObjectUrl(artUrl);
    changed = true;
  }
  if (!track.metaLocked) {
    if (tags.title && tags.title !== track.title) {
      track.title = tags.title;
      changed = true;
    }
    if (tags.artist) {
      track.artist = tags.artist;
      changed = true;
    }
    if (tags.album) {
      track.album = tags.album;
      changed = true;
    }
    if (tags.year && !track.createdAt) {
      track.createdAt = tags.year;
      changed = true;
    }
  }
  if (changed) {
    computeAlbums();
    if (state.nowPlayingId === track.id) {
      refreshNowPlayingUI(track);
      updateMediaSessionMetadata(track);
    }
  }
}

function probeAudioDuration(src) {
  return new Promise((resolve, reject) => {
    const probe = document.createElement("audio");
    probe.preload = "metadata";
    probe.muted = true;
    probe.src = src;

    const timer = window.setTimeout(() => finish(new Error("timeout")), 10000);
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      const duration = Number.isFinite(probe.duration) ? probe.duration : 0;
      window.clearTimeout(timer);
      probe.removeAttribute("src");
      probe.load();
      if (error) reject(error);
      else resolve(duration);
    };

    probe.addEventListener("loadedmetadata", () => finish(null), { once: true });
    probe.addEventListener("error", () => finish(new Error("metadata error")), { once: true });
  });
}

function scheduleRender() {
  if (renderTimer) return;
  renderTimer = window.setTimeout(() => {
    renderTimer = 0;
    renderLibraryAfterMetadata();
  }, 350);
}

function renderLibraryAfterMetadata() {
  computeAlbums();
  renderNavPlaylists();
  if (state.view === "albums" || state.view === "album" || state.view === "playlist" || state.view === "playlists") {
    if (!state.vizOpen) renderView();
  } else {
    // home view: update rows in place to preserve scroll
    const rows = refs.view.querySelectorAll(".track-row");
    for (const row of rows) {
      const t = getTrack(row.dataset.trackId);
      if (!t) continue;
      const idxEl = row.querySelector(".row-idx");
      if (idxEl) idxEl.textContent = row.dataset.position || "";
      const durEl = row.querySelector(".row-dur");
      if (durEl && t.duration) durEl.textContent = formatTime(t.duration);
      row.querySelector(".row-artist").textContent = t.artist || "Unknown artist";
    }
    updateActiveRow();
  }
  const track = getTrack(state.nowPlayingId);
  if (track) {
    playerState.duration = track.duration || playerState.duration;
    syncPlaybackUI();
  }
}

/* ============================================================
   Visualizer: full-screen overlay + playbar mini meter
    ============================================================ */

function buildBigPlayButton(onPlay, label, contextId = "") {
  const btn = buildNode("button", "big-play-row");
  btn.type = "button";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.dataset.state = !playerState.paused ? "playing" : "paused";
  btn.innerHTML = `
    <svg aria-hidden="true" class="ico-play"><use href="#i-play" /></svg>
    <svg aria-hidden="true" class="ico-pause"><use href="#i-pause" /></svg>`;
  btn.addEventListener("click", () => {
    if (!playerState.paused && (!contextId || activeContextIncludes(contextId))) {
      pauseCurrent();
      return;
    }
    onPlay();
  });
  return btn;
}

function fisherYates(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function activeContextIncludes(contextId) {
  return Boolean(contextId) && state.queueContextId === contextId;
}

function sortTracks(tracks) {
  const list = tracks.slice();
  switch (state.sortKey) {
    case "default":
      return list;
    case "title-desc":
      return list.sort((a, b) => b.title.localeCompare(a.title));
    case "artist-asc":
      return list.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
    case "duration-asc":
      return list.sort((a, b) => (a.duration || Infinity) - (b.duration || Infinity));
    case "duration-desc":
      return list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    case "date-desc":
      return list.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    case "title-asc":
    default:
      return list.sort((a, b) => a.title.localeCompare(b.title));
  }
}

function openViz() {
  const track = getTrack(state.nowPlayingId);
  if (!track && !state.queue.length) {
    showToast("Play a track first to open the visualizer");
    return;
  }
  state.vizOpen = true;
  refs.vizLayer.hidden = false;
  document.body.classList.add("viz-open");
  renderVizHud();
  syncPlaybackUI();
  refreshVizTransport();
  ensureAudioGraph();
  const mode = currentVizMode();
  if (mode.key === "butterchurn") {
    ensureButterchurn().then((ok) => {
      if (ok && state.vizOpen) resizeButterchurn();
    });
  }
  startVizLoop();
  scheduleHudIdle();
}

function closeViz() {
  state.vizOpen = false;
  refs.vizLayer.hidden = true;
  document.body.classList.remove("viz-open");
  stopVizLoop();
  drawImmersiveFrame.lastT = 0;
  if (!playerState.paused) startVizLoop();
}

function toggleViz() {
  if (state.vizOpen) closeViz();
  else openViz();
}

function refreshVizTransport() {
  const playing = !playerState.paused;
  refs.vizPlayPauseBtn.dataset.state = playing ? "playing" : "paused";
  refs.vizLayer.classList.toggle("muted-track", !state.nowPlayingId);
}

function syncVizSeek() {
  const duration = playerState.duration;
  const current = playerState.currentTime;
  if (state.vizOpen) {
    refs.vizCurTime.textContent = formatTime(current);
    refs.vizTotTime.textContent = formatTime(duration);
    if (duration > 0) {
      refs.vizSeekSlider.value = String(Math.round((current / duration) * 1000));
    }
    syncRangeFill(refs.vizSeekSlider);
  }
}

let hudIdleTimer = 0;

function wakeVizHud() {
  refs.vizLayer.classList.remove("hud-idle");
  if (hudIdleTimer) window.clearTimeout(hudIdleTimer);
  hudIdleTimer = window.setTimeout(() => {
    refs.vizLayer.classList.add("hud-idle");
  }, 3200);
}

function scheduleHudIdle() {
  wakeVizHud();
}

function onVizLayerClick(event) {
  if (event.target.closest("button, input, .viz-hud, .viz-transport, .viz-close, .viz-style-menu")) return;
  wakeVizHud();
  if (currentVizMode().key === "butterchurn" && bc.ready) {
    if (event.clientX < window.innerWidth * 0.35) nextButterchurnPreset(-1);
    else if (event.clientX > window.innerWidth * 0.65) nextButterchurnPreset(1);
  }
}

function onVizArrow(delta) {
  if (currentVizMode().key === "butterchurn" && bc.ready) {
    nextButterchurnPreset(delta);
  } else {
    stepViz(delta);
  }
  wakeVizHud();
}

function scheduleHudIdle() {
  wakeVizHud();
}

/* ---------------- style menu ---------------- */

function toggleVizStyleMenu(show) {
  const menu = document.getElementById("vizStyleMenu");
  const visible = !menu.hidden;
  const target = show === undefined ? !visible : show;
  if (target) renderVizStyleMenu();
  menu.hidden = !target;
  wakeVizHud();
}

function renderVizStyleMenu() {
  const list = document.getElementById("vizStyleList");
  list.innerHTML = "";
  VIZ_MODES.forEach((mode, idx) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "vsm-item" + (idx === state.vizIndex ? " active" : "");
    item.innerHTML = `<span class="vsm-name">${mode.name}</span><span class="vsm-sub"></span>`;
    if (mode.key === "butterchurn") {
      item.querySelector(".vsm-sub").textContent =
        bc.ready ? `${bc.presetNames.length} presets` : "loading…";
    } else {
      item.querySelector(".vsm-sub").textContent = "";
    }
    item.addEventListener("click", () => {
      if (idx !== state.vizIndex) stepViz(idx - state.vizIndex);
      renderVizStyleMenu();
      wakeVizHud();
    });
    list.appendChild(item);
    if (mode.key === "butterchurn" && idx === state.vizIndex && bc.ready) {
      const presets = document.createElement("div");
      presets.className = "vsm-presets";

      // full catalog loader (first use only)
      if (!bc.catalogLoaded) {
        const loader = document.createElement("button");
        loader.type = "button";
        loader.className = "vsm-loader";
        loader.textContent = `Load full preset catalog${
          bc.catalogPromise ? "…" : " (more presets)"
        }`;
        if (bc.catalogPromise) loader.disabled = true;
        loader.addEventListener("click", async () => {
          loader.disabled = true;
          loader.textContent = "Loading catalog…";
          await loadFullBcCatalog();
        });
        list.appendChild(loader);
      }

      const search = document.createElement("input");
      search.type = "search";
      search.className = "vsm-search";
      search.placeholder = "Filter presets…";
      search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        for (const btn of presets.querySelectorAll(".vsm-preset")) {
          btn.hidden = q ? !btn.dataset.name.toLowerCase().includes(q) : false;
        }
      });
      presets.appendChild(search);

      const favs = bc.favorites || [];
      // favorites first so the soothing keepers are one tap away
      for (const group of [favs, bc.presetNames.filter((n) => !favs.includes(n))]) {
        for (const name of group) {
          const row = document.createElement("div");
          row.className = "vsm-preset-row";
          const p = document.createElement("button");
          p.type = "button";
          p.className =
            "vsm-preset" +
            (name === bc.presetNames[((state.bcPresetIndex % bc.presetNames.length) + bc.presetNames.length) % bc.presetNames.length]
              ? " active"
              : "");
          p.dataset.name = name;
          p.textContent = name;
          p.addEventListener("click", () => {
            state.bcPresetIndex = Math.max(0, bc.presetNames.indexOf(name));
            applyButterchurnPreset(false);
            renderVizStyleMenu();
            renderVizHud();
            wakeVizHud();
          });
          const star = document.createElement("button");
          star.type = "button";
          star.className = "vsm-star" + (favs.includes(name) ? " on" : "");
          star.title = favs.includes(name) ? "Un-favorite" : "Favorite";
          star.textContent = favs.includes(name) ? "★" : "☆";
          star.addEventListener("click", () => {
            bc.favorites = favs;
            const i = favs.indexOf(name);
            if (i >= 0) favs.splice(i, 1);
            else favs.push(name);
            bcSaveFavorites();
            rebuildBcPresetList(Object.keys(bc.allPresets));
            renderVizStyleMenu();
            renderVizHud();
            wakeVizHud();
          });
          row.append(p, star);
          presets.appendChild(row);
        }
      }
      list.appendChild(presets);
    }
  });
  const reactInput = document.getElementById("vizReact");
  reactInput.value = String(Math.round(state.vizReact * 100));
  reactInput.addEventListener("input", () => {
    state.vizReact = Number(reactInput.value) / 100;
    applyVizReact();
    syncRangeFill(reactInput);
  });
  syncRangeFill(reactInput);
}

function onVizSeekInput() {
  if (!refs.audio || !playerState.duration) return;
  const fraction = Number(refs.vizSeekSlider.value) / 1000;
  refs.audio.currentTime = fraction * playerState.duration;
  playerState.currentTime = refs.audio.currentTime;
  refs.vizCurTime.textContent = formatTime(playerState.currentTime);
  syncRangeFill(refs.vizSeekSlider);
}

function currentVizMode() {
  const idx = ((state.vizIndex % VIZ_MODES.length) + VIZ_MODES.length) % VIZ_MODES.length;
  return VIZ_MODES[idx];
}

function stepViz(delta) {
  state.vizIndex = (state.vizIndex + delta + VIZ_MODES.length) % VIZ_MODES.length;
  if (state.vizOpen) {
    const mode = currentVizMode();
    if (mode.key === "butterchurn") {
      ensureButterchurn().then((ok) => {
        if (ok) resizeButterchurn();
      });
    }
    localStorage.setItem("mp_viz_mode", String(state.vizIndex));
  }
  renderVizHud();
}

function renderVizHud() {
  updateVizCanvases();
  const mode = currentVizMode();
  const label =
    mode.key === "butterchurn" && bc.ready && bc.presetNames.length
      ? bc.presetNames[
          ((state.bcPresetIndex % bc.presetNames.length) + bc.presetNames.length) % bc.presetNames.length
        ]
          .split(/ - /)
          .pop()
          .slice(0, 42)
      : mode.name;
  refs.vizName.textContent = label;
  document.getElementById("vizAutoCycle").hidden = mode.key !== "butterchurn";
  document.getElementById("vizAutoCycle").dataset.active = String(state.bcAutoCycle);
  refs.vizDots.innerHTML = VIZ_MODES.map(
    (p, idx) =>
      `<i data-mode="${p.key}" title="${p.name}" ${idx === state.vizIndex ? 'class="active"' : ""}></i>`
  ).join("");
  for (const dot of refs.vizDots.querySelectorAll("i")) {
    dot.addEventListener("click", () => {
      stepViz(VIZ_MODES.findIndex((m) => m.key === dot.dataset.mode) - state.vizIndex);
      wakeVizHud();
    });
  }
}

function updateVizCanvases() {
  const useGl = currentVizMode().key === "butterchurn" && bc.ready;
  refs.vizCanvas.hidden = useGl;
  const gl = document.getElementById("vizGlCanvas");
  if (gl) gl.hidden = !useGl;
}

function updateFeatures() {
  if (!analyser || !featureState) return;
  const now = audioContext ? audioContext.currentTime : performance.now() / 1000;
  const dt = clamp(now - lastFeatureTime, 1 / 240, 0.1);
  lastFeatureTime = now;

  analyser.getFloatFrequencyData(featureFreq);

  const nyquist = audioContext ? audioContext.sampleRate / 2 : 22050;
  const bins = featureFreq.length;

  for (let b = 0; b < BANDS.length; b++) {
    const lo = Math.floor((BANDS[b].lo / nyquist) * bins);
    const hi = Math.max(lo + 1, Math.min(bins - 1, Math.ceil((BANDS[b].hi / nyquist) * bins)));
    let peakDb = -100;
    for (let i = lo; i <= hi; i++) peakDb = Math.max(peakDb, featureFreq[i]);
    const raw = Math.pow(10, Math.max(-100, peakDb) / 20 / 10); // -100..0 dB -> 0..1
    featureState.bandTargets[b] = clamp(raw * BAND_WEIGHT[b], 0, 1.2);
  }

  // spectral flux (positive deltas) for onset detection
  let flux = 0;
  for (let b = 0; b < BANDS.length; b++) {
    const delta = featureState.bandTargets[b] - featureState.prevSpectrum[b];
    if (delta > 0) flux += delta;
    featureState.prevSpectrum[b] = featureState.bandTargets[b];
  }

  // per-band asymmetric envelopes
  for (let b = 0; b < BANDS.length; b++) {
    const target = featureState.bandTargets[b];
    const env = featureState.bandEnv[b];
    const up = target > env;
    const tc = up ? BAND_ENV[b].attack : BAND_ENV[b].release;
    featureState.bandEnv[b] = env + (target - env) * (1 - Math.exp(-dt / tc));
  }

  // rolling RMS with auto-gain
  let rms = 0;
  for (let b = 0; b < BANDS.length; b++) rms += featureState.bandEnv[b] * BAND_WEIGHT[b];
  rms /= BANDS.length;
  featureState.rmsAvg = featureState.rmsAvg * Math.exp(-dt / 1.5) + rms * (1 - Math.exp(-dt / 1.5));
  const autoGain = clamp(0.24 / Math.max(0.03, featureState.rmsAvg), 0.7, 1.9);
  featureState.autoGain = autoGain;

  /* beat grid state */
  featureState.intervals = featureState.intervals || [];
  featureState.beatInterval = featureState.beatInterval || 0.5;

  // onset: adaptive threshold on flux history
  featureState.fluxHistory.push(flux);
  if (featureState.fluxHistory.length > 360) featureState.fluxHistory.shift();
  let fluxMean = 0;
  for (const f of featureState.fluxHistory) fluxMean += f;
  fluxMean /= Math.max(1, featureState.fluxHistory.length);
  let fluxVar = 0;
  for (const f of featureState.fluxHistory) fluxVar += (f - fluxMean) * (f - fluxMean);
  const fluxStd = Math.sqrt(fluxVar / Math.max(1, featureState.fluxHistory.length));
  const onset = flux > fluxMean + 2.1 * fluxStd && now - featureState.lastOnset > 0.14;
  if (onset) {
    featureState.lastOnset = now;
    features.beatCount += 1;
  }

  /* beat grid: keep a steady tempo estimate + phase anchor so pulses line up
     with detected onsets and continue predictably between them */
  if (onset) {
    const interval = now - (featureState.lastOnsetTime || now - 0.5);
    if (interval > 0.25 && interval < 1.4) {
      featureState.intervals.push(interval);
      if (featureState.intervals.length > 8) featureState.intervals.shift();
      const sorted = [...featureState.intervals].sort((a, b) => a - b);
      featureState.beatInterval = sorted[Math.floor(sorted.length / 2)];
      // nudge the anchor phase toward this onset (only slightly, stays stable)
      if (featureState.gridAnchor) {
        const off = (now - featureState.gridAnchor) % featureState.beatInterval;
        const half = featureState.beatInterval / 2;
        const shift = off > half ? off - featureState.beatInterval : off;
        featureState.gridAnchor += clamp(shift, -half * 0.6, half * 0.6);
      }
    }
    featureState.lastOnsetTime = now;
  }
  if (!featureState.gridAnchor) featureState.gridAnchor = now;
  const interval = featureState.beatInterval || 0.5;
  while (now - featureState.gridAnchor >= interval) {
    featureState.gridAnchor += interval;
    featureState.tickCount = (featureState.tickCount || 0) + 1;
  }
  const phase = clamp((now - featureState.gridAnchor) / interval, 0, 1);
  features.pulse = Math.exp(-(now - featureState.gridAnchor) / (interval * 0.16));

  features.beat = Math.max(features.beat * Math.exp(-dt / 0.3), onset ? 1 : 0);
  const envOf = (b) => featureState.bandEnv[b] * autoGain;
  features.bass = envelopeTo(features.bass, Math.max(envOf(0), envOf(1)) * 1.3, dt, 0.05, 0.3);
  features.lowMid = envelopeTo(features.lowMid, envOf(2), dt, 0.06, 0.32);
  features.mid = envelopeTo(features.mid, envOf(3), dt, 0.07, 0.34);
  features.high = envelopeTo(features.high, Math.max(envOf(4), envOf(5)), dt, 0.07, 0.36);
  features.rms = envelopeTo(features.rms, rms * autoGain * 1.2, dt, 0.12, 0.5);
  features.energy = clamp(features.rms * 1.3, 0, 1.15);
  features.flux = envelopeTo(features.flux, flux * 2.2, dt, 0.08, 0.4);
  features.color = envelopeTo(
    features.color,
    clamp(envOf(5) / Math.max(0.12, rms), 0, 1.6),
    dt,
    0.5,
    0.9
  );
  // slow, calm copies for ambient visuals (kills the 'twitch')
  features.bassSlow = envelopeTo(features.bassSlow ?? 0, features.bass, dt, 0.18, 0.5);
  features.midSlow = envelopeTo(features.midSlow ?? 0, features.mid, dt, 0.2, 0.55);
  features.energySlow = envelopeTo(features.energySlow ?? 0, features.energy, dt, 0.25, 0.6);
  features.lastUpdate = now;
}

function envelopeTo(current, target, dt, tcAttack, tcRelease) {
  const tc = target > current ? tcAttack : tcRelease;
  const k = 1 - Math.exp(-dt / tc);
  return current + (target - current) * k;
}

function autoGainScale() {
  if (!featureState) return 1;
  return clamp(0.24 / Math.max(0.03, featureState.rmsAvg), 0.7, 1.9);
}

/* user-facing "Reaction" slider (0..1):
   - scales hand-made mode motion,
   - damps Butterchurn's input (1 => fedGain 1 is full raw signal) */
function reactMul() {
  return 0.45 + state.vizReact * 1.1;
}

function applyVizReact() {
  if (bc.fedGain) bc.fedGain.gain.value = clamp(1.15 - state.vizReact * 0.7, 0.3, 1.05);
  localStorage.setItem("mp_viz_react", String(state.vizReact));
}

function drawFrame() {
  if (!analyser) return;
  updateFeatures();
  drawMiniSpectrum();
  if (state.vizOpen) {
    if (currentVizMode().key === "butterchurn") {
      if (bc.ready && bc.viz) {
        if (state.bcAutoCycle && performance.now() - bc.lastSwitch > 45000) {
          nextButterchurnPreset(1);
          renderVizHud();
        }
        // renderer size is handled by resizeButterchurn(); calling it every frame
        // made butterchurn thrash its render pipeline and drop framerate
        bc.viz.render();
      }
    } else {
      drawImmersiveFrame();
    }
  }
}

function startVizLoop() {
  if (vizRAF) return;
  const frame = () => {
    try {
      drawFrame();
    } finally {
      vizRAF = requestAnimationFrame(frame);
    }
  };
  vizRAF = requestAnimationFrame(frame);
}

function stopVizLoop() {
  if (vizRAF) {
    cancelAnimationFrame(vizRAF);
    vizRAF = 0;
  }
  clearCanvas(refs.vizCanvas);
  clearCanvas(refs.miniViz, { fillLine: true });
}

function clearCanvas(canvas, options = {}) {
  if (!canvas || !canvas.width) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (options.fillLine) {
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(0, canvas.height / 2 - 1, canvas.width, 2);
  }
}

function drawImmersiveFrame() {
  const v = vizCtx();
  if (!v) return;
  const { ctx, w, h } = v;
  const now = performance.now() / 1000;
  const dt = clamp(now - (drawImmersiveFrame.lastT || now), 1 / 120, 0.05);
  drawImmersiveFrame.lastT = now;

  ctx.clearRect(0, 0, w, h);

  switch (currentVizMode().key) {
    case "aurora":
      drawAurora(ctx, w, h, dt);
      break;
    case "spectrum":
      drawSpectrum(ctx, w, h);
      break;
    case "nebula":
      drawNebula(ctx, w, h, dt);
      break;
    case "tunnel":
      drawTunnel(ctx, w, h, dt);
      break;
    default:
      drawNebula(ctx, w, h, dt);
      break;
  }
}

function drawMiniSpectrum() {
  const mini = refs.miniViz;
  if (!mini || !analyser) return;
  const ctx = mini.getContext("2d");
  ctx.clearRect(0, 0, mini.width, mini.height);
  const freq = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freq);
  const accent = accentColors().accent;
  const bars = 32;
  const nyquist = audioContext ? audioContext.sampleRate / 2 : 22050;
  const bins = freq.length;
  ctx.fillStyle = accent;
  for (let i = 0; i < bars; i++) {
    // log mapping: octave-equivalent spacing
    const fLo = Math.pow(10, 1.3 + (i / bars) * 3.7);
    const fHi = Math.pow(10, 1.3 + ((i + 1) / bars) * 3.7);
    const lo = clamp(Math.floor((fLo / nyquist) * bins), 0, bins - 1);
    const hi = clamp(Math.ceil((fHi / nyquist) * bins), lo + 1, bins - 1);
    let peak = 0;
    for (let b = lo; b <= hi; b++) peak = Math.max(peak, freq[b]);
    const v = (peak / 255) * autoGainScale();
    const bw = mini.width / bars;
    const barH = Math.max(2, clamp(v, 0, 1) * (mini.height - 6));
    ctx.globalAlpha = 0.45 + clamp(v, 0, 1) * 0.55;
    ctx.fillRect(i * bw + 1, mini.height - 3 - barH, bw - 2.4, barH);
  }
  ctx.globalAlpha = 1;
}

function accentColors() {
  const rootStyle = getComputedStyle(document.documentElement);
  return {
    accent: rootStyle.getPropertyValue("--accent").trim() || "#2fd4b0",
    accentRgb: rootStyle.getPropertyValue("--accent-rgb").trim() || "47, 212, 176",
  };
}

function currentVizMode() {
  return VIZ_MODES[((state.vizIndex % VIZ_MODES.length) + VIZ_MODES.length) % VIZ_MODES.length];
}

/* ------------------------------------------------------------
   Butterchurn engine (lazy-loaded from CDN, MIT-licensed)
   ------------------------------------------------------------ */

const bc = {
  ready: false,
  loading: false,
  viz: null,
  canvas: null,
  presetNames: [],
  favorites: [],
  lastSwitch: 0,
};

function loadScriptFirst(urls) {
  return new Promise((resolve, reject) => {
    let idx = 0;
    const tryNext = () => {
      if (idx >= urls.length) {
        reject(new Error("no source"));
        return;
      }
      const el = document.createElement("script");
      el.src = urls[idx++];
      el.async = false;
      el.onload = () => resolve(el.src);
      el.onerror = () => {
        el.remove();
        tryNext();
      };
      document.head.appendChild(el);
    };
    tryNext();
  });
}

function ensureButterchurn() {
  if (bc.ready) return Promise.resolve(true);
  if (bc.loadPromise) return bc.loadPromise;
  bc.loadPromise = Promise.all([
    loadScriptFirst(BUTTERCHURN_LIBS),
    loadScriptFirst(BUTTERCHURN_PRESET_LIBS),
  ])
    .then(() => {
      const core = window.butterchurn?.default || window.butterchurn;
      let plUnwrapped = window.butterchurnPresets?.default || window.butterchurnPresets;
      if (!core || !plUnwrapped) throw new Error("butterchurn missing");
      // the presets UMD may export a class instance, a bag with getPresets, or getPresets itself
      const presetsApi =
        typeof plUnwrapped === "function"
          ? (() => {
              try {
                return new plUnwrapped();
              } catch {
                return plUnwrapped;
              }
            })()
          : plUnwrapped;
      const all =
        (presetsApi?.getPresets?.() || plUnwrapped?.getPresets?.()) || presetsApi;
      const names = Object.keys(all);
      bc.allPresets = all;
      rebuildBcPresetList(names);

      bc.canvas = document.getElementById("vizGlCanvas");
      bc.viz = core.createVisualizer(audioContext, bc.canvas, {
        width: Math.max(2, bc.canvas.clientWidth || 800),
        height: Math.max(2, bc.canvas.clientHeight || 600),
        pixelRatio: 1,
      });
      // damping node in front of butterchurn keeps it smooth instead of frantic
      bc.fedGain = audioContext.createGain();
      applyVizReact();
      analyser.connect(bc.fedGain);
      bc.viz.connectAudio(bc.fedGain);
      bc.ready = true;
      resizeButterchurn();
      applyButterchurnPreset(true);
      renderVizHud();
      return true;
    })
    .catch((error) => {
      console.warn("butterchurn load failed", error);
      showToast("MilkDrop could not load — using built-in visuals");
      bc.ready = false;
      state.vizIndex = VIZ_MODES.findIndex((m) => m.key === "nebula");
      renderVizHud();
      return false;
    });
  return bc.loadPromise;
}

/* favorites + curated list + (optional) full catalog */
function bcFavorites() {
  try {
    const list = JSON.parse(localStorage.getItem("mp_bc_favs") || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function bcSaveFavorites() {
  localStorage.setItem("mp_bc_favs", JSON.stringify(bc.favorites || []));
}

function rebuildBcPresetList(namesIncludingExtra) {
  const seen = new Set();
  const names = namesIncludingExtra.filter((n) => {
    if (seen.has(n) || !bc.allPresets[n]) return false;
    seen.add(n);
    return true;
  });
  const favs = [...new Set((bc.favorites || bcFavorites()).filter((n) => names.includes(n)))];
  bc.favorites = favs;
  const curated = names.filter((n) => !favs.includes(n) && BUTTERCHURN_CURATE.some((k) => n.toLowerCase().includes(k)));
  const rest = names.filter((n) => !favs.includes(n) && !curated.includes(n)).sort();
  bc.presetNames = [...favs, ...curated, ...rest];
}

async function loadFullBcCatalog() {
  if (bc.catalogLoaded) return 0;
  bc.catalogPromise = Promise.all(BUTTERCHURN_EXTRA_LIBS.map((urls) => loadScriptFirst(urls)))
    .then(() => {
      let added = 0;
      for (const key of ["butterchurnPresetsExtra", "butterchurnPresetsExtra2"]) {
        const lib = window[key];
        if (!lib) continue;
        let presets = null;
        try {
          presets = typeof lib.getPresets === "function" ? lib.getPresets() : null;
        } catch {
          presets = null;
        }
        if (!presets && typeof lib === "function") {
          try {
            presets = new lib().getPresets?.() || null;
          } catch {
            presets = null;
          }
        }
        if (presets && typeof presets === "object") {
          for (const [name, preset] of Object.entries(presets)) {
            if (!bc.allPresets[name]) {
              bc.allPresets[name] = preset;
              added += 1;
            }
          }
        }
      }
      bc.catalogLoaded = true;
      rebuildBcPresetList(Object.keys(bc.allPresets));
      showToast(`Full MilkDrop catalog loaded — ${added} more presets`);
      renderVizStyleMenu();
      renderVizHud();
      return added;
    })
    .catch((error) => {
      console.warn("preset catalog load failed", error);
      showToast("Could not load the full preset catalog");
      return 0;
    });
  return bc.catalogPromise;
}

function applyButterchurnPreset(startFresh) {
  if (!bc.ready || !bc.presetNames.length) return;
  const idx = ((state.bcPresetIndex % bc.presetNames.length) + bc.presetNames.length) % bc.presetNames.length;
  state.bcPresetIndex = idx;
  const name = bc.presetNames[idx];
  bc.viz.loadPreset(bc.allPresets[name], startFresh ? 0 : 2.3);
  bc.lastSwitch = performance.now();
  if (state.vizOpen) renderVizHud();
}

function nextButterchurnPreset(delta) {
  if (!bc.presetNames.length) return;
  const n = bc.presetNames.length;
  state.bcPresetIndex = (((state.bcPresetIndex + delta) % n) + n) % n;
  if (bc.ready) applyButterchurnPreset(false);
}

function resizeButterchurn() {
  if (!bc.ready || !bc.canvas) return;
  const w = bc.canvas.clientWidth || window.innerWidth;
  const h = bc.canvas.clientHeight || window.innerHeight;
  const scale = window.innerWidth < 720 ? 0.66 : 1;
  const nw = Math.max(2, Math.round(w * scale));
  const nh = Math.max(2, Math.round(h * scale));
  if (bc.canvas.width === nw && bc.canvas.height === nh && bc.rendererW === nw) return;
  bc.canvas.width = nw;
  bc.canvas.height = nh;
  bc.rendererW = nw;
  bc.rendererH = nh;
  bc.viz.setRendererSize(nw, nh);
}

document.addEventListener("visibilitychange", () => {
  // coming back from a throttled background tab: reset the renderer & engine timing,
  // otherwise the visualizer runs at a degraded rate until the window is resized
  if (!document.hidden) {
    lastFeatureTime = 0;
    drawImmersiveFrame.lastT = 0;
    if (bc.ready && bc.viz) {
      bc.rendererW = 0; // force a setRendererSize cycle
      resizeButterchurn();
    }
    if (state.vizOpen) startVizLoop();
  }
});

/* ------------------------------------------------------------
   In-canvas helpers
   ------------------------------------------------------------ */

function vizCtx() {
  const canvas = refs.vizCanvas;
  const ctx = canvas.getContext("2d");
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  const w = canvas.clientWidth || refs.vizLayer.clientWidth;
  const h = canvas.clientHeight || refs.vizLayer.clientHeight;
  if (!w || !h) return null;
  if (canvas.width !== Math.round(w * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

/* soft radial glow sprite, reused across modes */
let glowSprite = null;
let glowSpriteKey = "";

function ensureGlow(colors) {
  if (!glowSprite || glowSpriteKey !== colors.accentRgb) {
    glowSprite = makeGlowSprite(colors.accentRgb);
    glowSpriteKey = colors.accentRgb;
  }
  return glowSprite;
}

function makeGlowSprite(rgb) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g2 = c.getContext("2d");
  const grad = g2.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb}, 0.75)`);
  grad.addColorStop(0.3, `rgba(${rgb}, 0.22)`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  g2.fillStyle = grad;
  g2.fillRect(0, 0, size, size);
  return c;
}

function rgbToHsl(r, g, b) {
  let h = 0;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max !== min) {
    const d = max - min;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return { h, s: 0.7, l: 0.55 };
}

function accentHue() {
  const [r, g, b] = accentColors().accentRgb.split(",").map((n) => Number(n.trim()) / 255);
  return rgbToHsl(r, g, b).h * 360;
}

function nowSec() {
  return performance.now() / 1000;
}

function hslToRgbCss(h, s, l) {
  const f = (n) => {
    const k = (n + (h / 360) * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * clamp(l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)), 0, 1));
  };
  return `${f(0)}, ${f(8)}, ${f(4)}`;
}

function vizPalette() {
  const hue = accentHue();
  return {
    accent: accentColors().accent,
    accentRgb: accentColors().accentRgb,
    hue,
    hueA: hue + 34,
    hueB: hue - 28,
    white: "rgba(255,255,255,0.85)",
  };
}

/* ------------------------------------------------------------
   Mode: Spectrum (log-frequency, mirrored, glow, peak caps)
   ------------------------------------------------------------ */

function drawSpectrum(ctx, w, h) {
  const colors = accentColors();
  const gap = Math.max(2, Math.round(w / 180));
  const barW = Math.max(3, Math.round(w / 84));
  const bars = Math.floor(w / (barW + gap));
  const nyquist = audioContext ? audioContext.sampleRate / 2 : 22050;
  const bins = analyser.frequencyBinCount;
  analyser.getByteFrequencyData(featureTmpUint8);
  const midY = h * 0.6;
  const maxH = h * 0.32;
  const glow = ensureGlow(colors);
  const dtFall = 0.55 / 60;
  const roundR = Math.min(barW / 2, 5);

  for (let i = 0; i < bars; i++) {
    const fLo = 32 * Math.pow(12000 / 32, i / bars);
    const fHi = 32 * Math.pow(12000 / 32, (i + 1) / bars);
    const lo = clamp(Math.floor((fLo / nyquist) * bins), 0, bins - 1);
    const hi = clamp(Math.ceil((fHi / nyquist) * bins), lo + 1, bins - 1);
    let peak = 0;
    for (let b = lo; b <= hi; b++) peak = Math.max(peak, featureTmpUint8[b]);
    const ag = autoGainScale();
    const v = clamp((peak / 255) * ag * 1.2, 0, 1);
    const x = i * (barW + gap) + gap;
    const eased = v * v * (1.7 - v);
    const barH = Math.max(barW * 0.9, eased * maxH);
    const yTop = midY - barH;
    const target = barH / maxH;

    // falling peak cap (constant fall speed)
    const cap = target > (spectrumPeakData[i] || 0)
      ? target
      : Math.max(target, (spectrumPeakData[i] || 0) - dtFall);
    spectrumPeakData[i] = cap;

    const grad = ctx.createLinearGradient(0, midY, 0, yTop);
    grad.addColorStop(0, `rgba(${colors.accentRgb}, 0.12)`);
    grad.addColorStop(0.4, `rgba(${colors.accentRgb}, 0.5)`);
    grad.addColorStop(1, colors.accent);
    ctx.fillStyle = grad;
    roundRectPath(ctx, x, yTop, barW, barH, roundR);
    ctx.fill();

    // reflection
    const refl = ctx.createLinearGradient(0, midY, 0, midY + barH * 0.45);
    refl.addColorStop(0, `rgba(${colors.accentRgb}, 0.18)`);
    refl.addColorStop(1, `rgba(${colors.accentRgb}, 0)`);
    ctx.fillStyle = refl;
    roundRectPath(ctx, x, midY + 2, barW, barH * 0.45, roundR);
    ctx.fill();

    // falling peak cap
    if (cap - target > 0.01) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(x, midY - cap * maxH - 2, barW, 2);
    }
  }

  // horizon line
  ctx.fillStyle = `rgba(${colors.accentRgb}, ${0.22 + features.beat * 0.45})`;
  ctx.fillRect(0, midY - 0.5, w, 1.5);

  // ambient bloom with bass
  if (features.bass > 0.25 || features.beat > 0.4) {
    ctx.globalAlpha = clamp((features.bass * 0.14 + features.beat * 0.1) * 0.9, 0, 0.35);
    ctx.drawImage(glow, w / 2 - h * 0.55, midY - h * 0.55, h * 1.1, h * 1.1);
    ctx.globalAlpha = 1;
  }
}

const spectrumPeakData = new Array(240).fill(0);

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, Math.max(0, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* featureTmp reused for byte data */
let featureTmpUint8 = new Uint8Array(0);

/* ------------------------------------------------------------
   Mode: Aurora (layered ribbons, hue drift, gentle bloom)
   ------------------------------------------------------------ */

let auroraT = 0;
function drawAurora(ctx, w, h, dt) {
  const colors = accentColors();
  auroraT += dt * (0.35 + features.energy * 0.8);

  // trail persistence for silky motion
  ctx.fillStyle = "rgba(10,10,13,0.14)";
  ctx.fillRect(0, 0, w, h);

  const layers = 4;
  for (let layer = 0; layer < layers; layer++) {
    // amplitude follows the *slow* bass copy — smooth swells, no twitch
    const amp =
      h * (0.13 + layer * 0.045) *
      (0.35 + clamp(features.bassSlow * 1.7, 0, 1.5) + features.pulse * 0.18);
    const phase = auroraT * (0.35 + layer * 0.13) + layer * 2.1;
    const hue = (accentHue() + layer * 26 + features.color * 60 - 30 + 360) % 360;
    ctx.beginPath();
    const segments = 56;
    for (let s = 0; s <= segments; s++) {
      const x = (s / segments) * w;
      const y =
        h * (0.55 - features.midSlow * 0.06) +
        Math.sin(s * 0.045 + phase) * amp +
        Math.sin(s * 0.11 - phase * 1.7) * amp * (0.3 + features.high * 0.3) +
        Math.cos(auroraT * 0.5 + layer) * h * 0.03;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = (14 + layer * 22) * (0.55 + clamp(features.energySlow * 1.5, 0, 1.6) + features.pulse * 0.12);
    ctx.lineCap = "round";
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, `hsla(${hue}, 75%, 55%, 0)`);
    grad.addColorStop(0.25, `hsla(${hue}, 75%, 55%, ${0.2 + features.mid * 0.5})`);
    grad.addColorStop(0.55, `hsla(${(hue + 30) % 360}, 80%, 60%, ${0.26 + features.high * 0.55})`);
    grad.addColorStop(0.8, `hsla(${(hue + 60) % 360}, 75%, 55%, ${0.2 + features.mid * 0.4})`);
    grad.addColorStop(1, `hsla(${hue}, 75%, 55%, 0)`);
    ctx.strokeStyle = grad;
    ctx.shadowColor = `hsla(${hue}, 80%, 60%, 0.6)`;
    ctx.shadowBlur = 26 + features.bassSlow * 50 + features.pulse * 45;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // sparse stars
  auroraStars(ctx, w, h, dt);
}

const auroraStarList = [];
function auroraStars(ctx, w, h, dt) {
  if (!auroraStarList.length) {
    for (let i = 0; i < 90; i++) {
      auroraStarList.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.5 + Math.random() * 1.4,
        p: Math.random() * Math.PI * 2,
        s: 0.3 + Math.random() * 1.2,
      });
    }
  }
  for (const star of auroraStarList) {
    star.p += dt * star.s * (0.6 + features.high * 2.2);
    const tw = 0.5 + Math.sin(star.p) * 0.5;
    ctx.fillStyle = `rgba(255,255,255,${0.05 + tw * 0.3})`;
    ctx.beginPath();
    ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ------------------------------------------------------------
   Mode: Nebula (orbit field — never collapses, always alive)
   ------------------------------------------------------------ */

const nebulaParts = [];
function drawNebula(ctx, w, h, dt) {
  const colors = accentColors();
  ctx.fillStyle = "rgba(10,10,13,0.2)";
  ctx.fillRect(0, 0, w, h);

  if (!nebulaParts.length) {
    for (let i = 0; i < 240; i++) {
      nebulaParts.push({
        // each particle owns its own orbit: radius band + angle band
        orbitR: 0.14 + Math.random() * 0.34,
        angle: Math.random() * Math.PI * 2,
        speed: 0.08 + Math.random() * 0.2,
        dir: Math.random() < 0.12 ? -1 : 1,
        r: 0.8 + Math.random() * 2.4,
        tw: Math.random() * Math.PI * 2,
        wobble: Math.random() * Math.PI * 2,
      });
    }
  }

  const cx = w / 2;
  const cy = h / 2;
  const minDim = Math.min(w, h);
  const react = reactMul();

  ctx.globalCompositeOperation = "lighter";
  const glow = ensureGlow(colors);
  for (const p of nebulaParts) {
    // inner orbits track bass, outer orbits track highs — clearly visible cause
    const speedR = 0.55 + (p.orbitR < 0.26 ? features.bass : features.high) * 1.5;
    p.angle += p.speed * p.dir * speedR * react * dt;
    p.wobble += dt * (0.3 + features.mid * 0.8) * react;
    // radius breathes with rms; beat gives a one-off outward ring ripple
    const ripple = features.beat * 0.06 + features.rms * 0.06;
    const r = (p.orbitR + ripple * Math.sin(p.wobble * 0.7)) * minDim;
    const wob = 1 + Math.sin(p.wobble) * 0.08;
    p.x = cx + Math.cos(p.angle) * r * wob;
    p.y = cy + Math.sin(p.angle) * r * wob * 0.92; // slight ellipse for depth
    p.tw += dt * (1 + features.high * 3);
    const s = 9 + p.r * 6 + features.beat * 12;
    ctx.globalAlpha =
      0.08 +
      clamp(0.16 + features.mid * 0.55, 0, 0.8) * (0.4 + 0.6 * Math.sin(p.tw) ** 2);
    ctx.drawImage(glow, p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/* ------------------------------------------------------------
   Mode: Tunnel (calm depth scroll, pulses locked to the beat grid)
   ------------------------------------------------------------ */

let tunnelScroll = 0;
const shockWaves = [];

function drawTunnel(ctx, w, h, dt) {
  const colors = accentColors();
  const cx = w / 2;
  const cy = h * 0.48;
  const prevTick = drawTunnel.lastTick ?? features.tickCount ?? 0;

  // fade trail for depth persistence
  ctx.fillStyle = "rgba(10,10,13,0.3)";
  ctx.fillRect(0, 0, w, h);

  // scroll speed is smooth (rms-driven), so it feels constant, not erratic
  tunnelScroll = (tunnelScroll + (0.07 + features.energySlow * 0.12) * dt) % 1;
  const rings = 13;
  for (let i = 0; i < rings; i++) {
    const frac = (i / rings + tunnelScroll) % 1;
    const depth = 1 - frac;
    const persp = Math.pow(depth, 2.1);
    const radius = 24 + persp * Math.min(w, h) * 0.6 * (1 + features.bassSlow * 0.2);
    const alpha = clamp(persp * 0.5, 0.03, 0.55);
    // hue drifts from accent at the horizon to accent+50 near the camera
    const hue = (accentHue() + depth * 50 + 360) % 360;
    const rgb = hslToRgbCss(hue, 0.72, 0.55);
    ctx.lineWidth = 1 + persp * 2.2;
    ctx.strokeStyle = `rgba(${rgb}, ${alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // glowing core: slow bass breathing + a crisp tick flash locked to the grid
  ctx.globalCompositeOperation = "lighter";
  const glow = ensureGlow(colors);
  const coreS = 55 + features.bassSlow * 130 + features.beat * 40;
  ctx.globalAlpha = 0.3 + features.bassSlow * 0.3;
  ctx.drawImage(glow, cx - coreS / 2, cy - coreS / 2, coreS, coreS);
  // grid pulse: the metronome tick — a bright flash spread across the core ring
  if (features.pulse > 0.12) {
    const ps = coreS * (1 + (1 - features.pulse) * 3.4);
    ctx.globalAlpha = clamp(features.pulse * 0.55, 0, 0.85);
    ctx.drawImage(glow, cx - ps / 2, cy - ps / 2, ps, ps);
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  // shockwaves fire exactly on grid ticks (features.tickCount advances each beat)
  if (prevTick !== undefined && (features.tickCount ?? 0) !== prevTick) {
    if (!shockWaves.length || nowSec() - shockWaves[shockWaves.length - 1].t > 0.22) {
      shockWaves.push({ r: 34, a: 0.55, t: nowSec() });
    }
  }
  drawTunnel.lastTick = features.tickCount ?? 0;
  for (let i = shockWaves.length - 1; i >= 0; i--) {
    const sw = shockWaves[i];
    sw.r += dt * Math.min(w, h) * 0.85;
    sw.a *= Math.exp(-dt * 2);
    if (sw.a < 0.02) {
      shockWaves.splice(i, 1);
      continue;
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(${colors.accentRgb}, ${sw.a})`;
    ctx.beginPath();
    ctx.arc(cx, cy, sw.r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/* ============================================================
   UI wiring
   ============================================================ */

function isMobileViewport() {
  return Boolean(window.matchMedia && window.matchMedia("(max-width: 860px)").matches);
}

function bindEvents() {
  for (const item of refs.navItems) {
    item.addEventListener("click", () => goToView(item.dataset.nav));
  }

  refs.newPlaylistBtn.addEventListener("click", () => promptNewPlaylist());
  refs.pickFolderBtn.addEventListener("click", onPickFolderClick);
  refs.reloadLibraryBtn.addEventListener("click", loadLibrary);

  refs.helpBtn.addEventListener("click", toggleHelpDialog);
  refs.helpCloseBtn.addEventListener("click", toggleHelpDialog);
  refs.helpDialog.addEventListener("click", (event) => {
    if (event.target === refs.helpDialog) refs.helpDialog.close();
  });

  refs.searchInput.addEventListener("input", onSearchInput);

  refs.navToggle.addEventListener("click", () => {
    if (isMobileViewport()) {
      document.body.classList.toggle("nav-open");
      refs.navToggle.title = document.body.classList.contains("nav-open")
        ? "Close menu"
        : "Open menu";
    } else {
      document.body.classList.toggle("nav-collapsed");
      refs.navToggle.title = document.body.classList.contains("nav-collapsed")
        ? "Expand sidebar"
        : "Collapse sidebar";
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (
      document.body.classList.contains("nav-open") &&
      !event.target.closest(".nav")
    ) {
      document.body.classList.remove("nav-open");
    }
  });

  refs.vizPresetSelect.addEventListener("change", onVizSelectChange);
  refs.themeSelect.addEventListener("change", onThemeChange);
  refs.accentSelect.addEventListener("change", onAccentChange);
  refs.autoplayToggle.addEventListener("change", onAutoplayToggle);
  refs.boostToggle.addEventListener("change", onBoostToggle);

  window.matchMedia?.("(prefers-color-scheme: light)")?.addEventListener?.("change", () => {
    if (state.theme === "auto") applyTheme();
  });

  refs.pbTitle.addEventListener("click", () => goToTrackAlbum());
  refs.pbArtist.addEventListener("click", () => {
    const track = getTrack(state.nowPlayingId);
    if (track) {
      state.searchTerm = track.artist;
      refs.searchInput.value = track.artist;
      goToView("albums");
    }
  });
  refs.playPauseBtn.addEventListener("click", togglePlayback);
  refs.prevBtn.addEventListener("click", playPrevious);
  refs.nextBtn.addEventListener("click", playNext);
  refs.shuffleBtn.addEventListener("click", toggleShuffle);
  refs.repeatBtn.addEventListener("click", cycleRepeat);
  refs.muteBtn.addEventListener("click", toggleMute);
  refs.volumeSlider.addEventListener("input", onVolumeInput);
  refs.seekSlider.addEventListener("input", onSeekInput);
  refs.vizOpenBtn.addEventListener("click", toggleViz);
  document.getElementById("vizOpenSmBtn").addEventListener("click", toggleViz);
  refs.vizCloseBtn.addEventListener("click", closeViz);
  document.getElementById("vizPrevPreset").addEventListener("click", () => onVizArrow(-1));
  document.getElementById("vizNextPreset").addEventListener("click", () => onVizArrow(1));
  refs.vizPrevBtn.addEventListener("click", playPrevious);
  refs.vizNextBtn.addEventListener("click", playNext);
  refs.vizPlayPauseBtn.addEventListener("click", togglePlayback);
  refs.vizSeekSlider.addEventListener("input", onVizSeekInput);
  refs.vizLayer.addEventListener("click", onVizLayerClick);
  refs.vizLayer.addEventListener("pointerdown", wakeVizHud);
  refs.vizLayer.addEventListener("pointermove", wakeVizHud);
  document.getElementById("vizAutoCycle").addEventListener("click", () => {
    state.bcAutoCycle = !state.bcAutoCycle;
    localStorage.setItem("mp_bc_auto", state.bcAutoCycle ? "1" : "0");
    document.getElementById("vizAutoCycle").dataset.active = String(state.bcAutoCycle);
    wakeVizHud();
  });
  document.getElementById("vizStyleBtn").addEventListener("click", () => toggleVizStyleMenu());
  document.getElementById("vizStyleClose").addEventListener("click", () => toggleVizStyleMenu(false));
  window.addEventListener("resize", () => {
    if (state.vizOpen && currentVizMode().key === "butterchurn") resizeButterchurn();
  });

  refs.settingsBtn.addEventListener("click", () => {
    openSettingsDialog();
  });
  refs.settingsCloseBtn.addEventListener("click", () => refs.settingsDialog.close());
  refs.settingsDialog.addEventListener("click", (event) => {
    if (event.target === refs.settingsDialog) refs.settingsDialog.close();
  });

  refs.newPlaylistForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = refs.newPlaylistName.value;
    const trackId = refs.newPlaylistDialog.dataset.trackId || null;
    refs.newPlaylistDialog.close();
    if (!name || !name.trim()) return;
    const playlist = createPlaylist(name, trackId ? [trackId] : []);
    renderNavPlaylists();
    goToView("playlist", playlist.id);
    showToast(`Created "${playlist.name}"`);
  });
  for (const cancelBtn of ["newPlaylistCancel", "newPlaylistCancel2"]) {
    document.getElementById(cancelBtn).addEventListener("click", () => refs.newPlaylistDialog.close());
  }
  refs.newPlaylistName.addEventListener("keydown", (event) => {
    if (event.key === "Escape") refs.newPlaylistDialog.close();
  });

  document.addEventListener("pointerdown", (event) => {
    if (refs.addMenu.hidden === false && !refs.addMenu.contains(event.target)) {
      closeRowMenu();
    }
  });

  document.addEventListener("keydown", onKeyDown);
}

function openSettingsDialog() {
  if (!refs.settingsDialog.open) refs.settingsDialog.showModal();
}

function toggleHelpDialog() {
  if (refs.helpDialog.open) refs.helpDialog.close();
  else refs.helpDialog.showModal();
}

function onSearchInput() {
  state.searchTerm = refs.searchInput.value;
  renderView();
}

function onVolumeInput() {
  state.volume = Number(refs.volumeSlider.value);
  state.muted = false;
  applyVolume();
  localStorage.setItem("mp_volume", String(state.volume));
  localStorage.setItem("mp_muted", "0");
  syncRangeFill(refs.volumeSlider);
  refreshVolumeControls();
}

function refreshVolumeControls() {
  const level = state.muted ? "mute" : state.volume < 0.5 ? "low" : "high";
  refs.muteBtn.dataset.level = level;
  syncRangeFill(refs.volumeSlider);
}

function toggleMute() {
  state.muted = !state.muted;
  applyVolume();
  localStorage.setItem("mp_muted", state.muted ? "1" : "0");
  refreshVolumeControls();
}

function onSeekInput() {
  if (!refs.audio || !playerState.duration) return;
  const fraction = Number(refs.seekSlider.value) / 1000;
  refs.audio.currentTime = fraction * playerState.duration;
  playerState.currentTime = refs.audio.currentTime;
  refs.currentTimeLabel.textContent = formatTime(playerState.currentTime);
  syncRangeFill(refs.seekSlider);
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  localStorage.setItem("mp_shuffle", state.shuffle ? "1" : "0");
  refreshTransportControls();
  showToast(`Shuffle mode ${state.shuffle ? "on" : "off"}`);
}

function cycleRepeat() {
  state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
  localStorage.setItem("mp_repeat", state.repeat);
  refreshTransportControls();
  showToast(`Repeat: ${state.repeat}`);
}

function refreshTransportControls() {
  refs.shuffleBtn.dataset.active = String(state.shuffle);
  refs.repeatBtn.dataset.active = String(state.repeat !== "off");
  refs.repeatBtn.dataset.repeat = state.repeat;
  refs.repeatBtn.title = `Repeat: ${state.repeat === "off" ? "off" : state.repeat === "all" ? "whole list" : "one track"} (R)`;
  syncRangeFill(refs.seekSlider);
}

function onThemeChange() {
  state.theme = refs.themeSelect.value;
  localStorage.setItem("mp_theme", state.theme);
  applyTheme();
}

function onAccentChange() {
  state.accent = refs.accentSelect.value;
  localStorage.setItem("mp_accent", state.accent);
  applyTheme();
}

function onAutoplayToggle() {
  state.autoplayNext = refs.autoplayToggle.checked;
  localStorage.setItem("mp_autoplay_next", state.autoplayNext ? "1" : "0");
}

function onBoostToggle() {
  state.boostEnabled = refs.boostToggle.checked;
  localStorage.setItem("mp_volume_boost", state.boostEnabled ? "1" : "0");
  applyBoost();
}

function onVizSelectChange() {
  const key = refs.vizPresetSelect.value;
  const pos = VIZ_MODES.findIndex((p) => p.key === key);
  state.vizIndex = pos >= 0 ? pos : 0;
  localStorage.setItem("mp_viz_mode", String(state.vizIndex));
  if (state.vizOpen) {
    if (VIZ_MODES[state.vizIndex].key === "butterchurn") {
      ensureButterchurn().then((ok) => {
        if (ok) resizeButterchurn();
      });
    }
    renderVizHud();
  }
}

function onKeyDown(event) {
  const tag = document.activeElement?.tagName || "";
  const typing =
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    refs.helpDialog.open ||
    refs.settingsDialog.open ||
    refs.newPlaylistDialog.open;
  if (event.key === "Escape" && state.vizOpen) {
    closeViz();
    return;
  }
  if (typing) return;
  if (state.vizOpen) {
    if (event.key === "ArrowRight") { 
      event.preventDefault();
      onVizArrow(1);
      wakeVizHud();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onVizArrow(-1);
      wakeVizHud();
      return;
    }
  }

  switch (event.key) {
    case " ":
      event.preventDefault();
      togglePlayback();
      break;
    case "ArrowRight":
      if (!state.vizOpen && refs.audio && playerState.duration) {
        refs.audio.currentTime = Math.min(playerState.duration, refs.audio.currentTime + 5);
      }
      break;
    case "ArrowLeft":
      if (!state.vizOpen && refs.audio) {
        refs.audio.currentTime = Math.max(0, refs.audio.currentTime - 5);
      }
      break;
    case "ArrowUp": {
      event.preventDefault();
      state.volume = clamp(state.volume + 0.05, 0, 1);
      state.muted = false;
      refs.volumeSlider.value = String(state.volume);
      localStorage.setItem("mp_volume", String(state.volume));
      applyVolume();
      refreshVolumeControls();
      break;
    }
    case "ArrowDown": {
      event.preventDefault();
      state.volume = clamp(state.volume - 0.05, 0, 1);
      refs.volumeSlider.value = String(state.volume);
      localStorage.setItem("mp_volume", String(state.volume));
      applyVolume();
      refreshVolumeControls();
      break;
    }
    case "n":
    case "N":
      playNext();
      break;
    case "p":
    case "P":
      playPrevious();
      break;
    case "s":
    case "S":
      toggleShuffle();
      break;
    case "r":
    case "R":
      cycleRepeat();
      break;
    case "v":
    case "V":
      toggleViz();
      break;
    case "m":
    case "M":
      toggleMute();
      break;
    case "/":
      event.preventDefault();
      refs.searchInput.focus();
      break;
    case "?":
      toggleHelpDialog();
      break;
    default:
      break;
  }
}

function showToast(message) {
  const toast = buildNode("div", "toast", message);
  refs.toastStack.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 250);
  }, 3200);
}
