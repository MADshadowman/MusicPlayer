"use strict";

const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "flac", "ogg", "oga", "opus", "wav", "weba", "m4b"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const MANIFEST_CANDIDATES = ["tracks/tracks.json", "tracks.json"];
const METADATA_PROBE_CONCURRENCY = 3;
const MEDIA_SESSION_SUPPORTED =
  "mediaSession" in navigator && "MediaMetadata" in window;

const VIZ_PRESETS = [
  { key: "bars", name: "Spectrum bars" },
  { key: "orbit", name: "Orbit rings" },
  { key: "wave", name: "Aurora wave" },
  { key: "particles", name: "Rising particles" },
  { key: "grid", name: "Grid sunset" },
];

const state = {
  tracks: [],
  albums: [],
  queue: [],
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
  queueContextId: "",
  sortKey: "title-asc",
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
  sortSelect: document.getElementById("sortSelect"),
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
  miniViz: document.getElementById("miniViz"),
  settingsBtn: document.getElementById("settingsBtn"),
  settingsPanel: document.getElementById("settingsPanel"),
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
let boostGain = null;
let analyser = null;
let vizRAF = 0;
let menuAnchor = null;
let lastPositionStateWrite = 0;
let renderTimer = 0;
let particlesSeed = 0;
const particles = [];
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

  const savedViz = localStorage.getItem("mp_viz_preset");
  const vizPos = VIZ_PRESETS.findIndex((p) => p.key === savedViz);
  state.vizIndex = vizPos >= 0 ? vizPos : 0;
  refs.vizPresetSelect.innerHTML = VIZ_PRESETS.map(
    (p) => `<option value="${p.key}">${p.name}</option>`
  ).join("");
  refs.vizPresetSelect.value = VIZ_PRESETS[state.vizIndex].key;

  state.sortKey = localStorage.getItem("mp_sort") || "title-asc";
  const sortOpts = [...refs.sortSelect.options].map((o) => o.value);
  if (!sortOpts.includes(state.sortKey)) state.sortKey = "title-asc";
  refs.sortSelect.value = state.sortKey;

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
  if (refs.audio) {
    refs.audio.volume = state.volume;
    refs.audio.muted = state.muted;
  }
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
    analyser.smoothingTimeConstant = 0.8;
    boostGain = audioContext.createGain();
    applyBoost();
    sourceNode.connect(analyser);
    analyser.connect(boostGain);
    boostGain.connect(audioContext.destination);
  }
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
  head.innerHTML = `<span></span><span class="th">Track</span><span></span>`;
  list.appendChild(head);
  for (const track of tracks) {
    list.appendChild(buildTrackRow(track, null));
  }
  return list;
}

function buildTrackRow(track) {
  const row = refs.trackRowTemplate.content.firstElementChild.cloneNode(true);
  row.dataset.trackId = track.id;
  row.querySelector(".row-idx").textContent = String(state.tracks.indexOf(track) + 1);
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
      return album ? album.trackIds : allIds();
    }
    case "playlist": {
      const playlist = getPlaylists().find((p) => p.id === state.viewId);
      return playlist ? playlist.trackIds : allIds();
    }
    case "playlists":
    default:
      return state.tracks.filter(matchFilter).map((t) => t.id);
  }
}

function allIds() {
  return state.tracks.filter(matchFilter).map((t) => t.id);
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
  shuffleAlbum.setAttribute("aria-label", "Shuffle album");
  shuffleAlbum.innerHTML = `<svg aria-hidden="true"><use href="#i-shuffle" /></svg><span>Shuffle</span>`;
  shuffleAlbum.addEventListener("click", () => {
    const shuffled = album.trackIds.slice().sort(() => Math.random() - 0.5);
    ensureQueueFromIds(shuffled, null);
    playQueueIndex(0, { autoplay: true });
  });
  actions.appendChild(bigPlay);
  actions.appendChild(shuffleAlbum);
  fragment.appendChild(actions);

  fragment.appendChild(trackList(sortTracks(visible)));
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
  shuffleBtn.setAttribute("aria-label", "Shuffle playlist");
  shuffleBtn.innerHTML = `<svg aria-hidden="true"><use href="#i-shuffle" /></svg><span>Shuffle</span>`;
  shuffleBtn.addEventListener("click", () => {
    if (!tracks.length) return;
    const shuffledIds = tracks.map((t) => t.id).sort(() => Math.random() - 0.5);
    ensureQueueFromIds(shuffledIds, null);
    playQueueIndex(0, { autoplay: true });
  });
  actions.appendChild(bigPlay);
  actions.appendChild(shuffleBtn);
  fragment.appendChild(actions);

  if (!tracks.length) {
    fragment.appendChild(buildNode("div", "view-empty", "This playlist is empty (or its tracks are no longer in the library)."));
  } else {
    fragment.appendChild(trackList(sortTracks(tracks)));
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
  const name = window.prompt("Playlist name");
  if (!name || !name.trim()) return;
  const playlist = createPlaylist(name, trackId ? [trackId] : []);
  renderNavPlaylists();
  goToView("playlist", playlist.id);
  showToast(`Created "${playlist.name}"`);
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
      if (idxEl) idxEl.textContent = String(state.tracks.indexOf(t) + 1);
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

function activeContextIncludes(contextId) {
  return Boolean(contextId) && state.queueContextId === contextId;
}

function sortTracks(tracks) {
  const list = tracks.slice();
  switch (state.sortKey) {
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

function averageBins(freq, count) {
  const n = Math.min(count, freq.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += freq[i];
  }
  return sum / n;
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
  ensureAudioGraph();
  startVizLoop();
}

function closeViz() {
  state.vizOpen = false;
  refs.vizLayer.hidden = true;
  document.body.classList.remove("viz-open");
  stopVizLoop();
  if (!playerState.paused) startVizLoop();
}

function toggleViz() {
  if (state.vizOpen) closeViz();
  else openViz();
}

function stepViz(delta) {
  state.vizIndex = (state.vizIndex + delta + VIZ_PRESETS.length) % VIZ_PRESETS.length;
  renderVizHud();
}

function renderVizHud() {
  const preset = VIZ_PRESETS[state.vizIndex];
  refs.vizName.textContent = preset.name;
  refs.vizDots.innerHTML = VIZ_PRESETS.map(
    (p, idx) => `<i ${idx === state.vizIndex ? 'class="active"' : ""}></i>`
  ).join("");
}

function drawFrame() {
  if (analyser) {
    drawMiniSpectrum();
    if (state.vizOpen) {
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
  const canvas = refs.vizCanvas;
  const ctx = canvas.getContext("2d");
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  const w = canvas.clientWidth || refs.vizLayer.clientWidth;
  const h = canvas.clientHeight || refs.vizLayer.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const freq = new Uint8Array(analyser.frequencyBinCount);
  const time = new Uint8Array(analyser.fftSize);
  analyser.getByteFrequencyData(freq);
  analyser.getByteTimeDomainData(time);
  const colors = accentColors();
  const bass = averageBins(freq, 10) / 255;

  ctx.clearRect(0, 0, w, h);

  switch (VIZ_PRESETS[state.vizIndex].key) {
    case "orbit":
      drawOrbit(ctx, w, h, freq, colors, bass);
      break;
    case "wave":
      drawWave(ctx, w, h, time, colors, bass);
      break;
    case "particles":
      drawParticles(ctx, w, h, freq, colors, bass);
      break;
    case "grid":
      drawGrid(ctx, w, h, freq, colors, performance.now() / 1000, bass);
      break;
    case "bars":
    default:
      drawBars(ctx, w, h, freq, colors, bass);
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
  const bars = 26;
  const bins = Math.floor((freq.length * 0.4));
  ctx.fillStyle = accent;
  for (let i = 0; i < bars; i++) {
    const bin = Math.floor((i / bars) * bins);
    const v = (freq[bin] || 0) / 255;
    const bw = mini.width / bars;
    const barH = Math.max(2, v * v * (mini.height - 6));
    ctx.globalAlpha = 0.4 + v * 0.6;
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

/* Preset: spectrum bars (mirrored) */

function drawBars(ctx, w, h, freq, colors, bass) {
  const bars = Math.max(40, Math.floor(w / 12));
  const mid = h / 2;
  const bins = Math.floor(freq.length * 0.72);
  for (let i = 0; i < bars; i++) {
    const bin = Math.floor((i / bars) * bins);
    const v = (freq[bin] || 0) / 255;
    const eased = v * v * (3 - 2 * v);
    const barH = Math.max(3, eased * h * 0.42);
    const bw = w / bars;
    const x = i * bw;

    const up = ctx.createLinearGradient(0, mid, 0, mid - barH);
    up.addColorStop(0, `rgba(${colors.accentRgb}, 0.15)`);
    up.addColorStop(0.6, `rgba(${colors.accentRgb}, 0.45)`);
    up.addColorStop(1, colors.accent);
    ctx.fillStyle = up;
    ctx.fillRect(x + 1, mid - barH, bw - 2, barH);

    const down = ctx.createLinearGradient(0, mid, 0, mid + barH);
    down.addColorStop(0, `rgba(${colors.accentRgb}, 0.11)`);
    down.addColorStop(1, `rgba(${colors.accentRgb}, 0.01)`);
    ctx.fillStyle = down;
    ctx.fillRect(x + 1, mid, bw - 2, barH);
  }
  ctx.fillStyle = `rgba(${colors.accentRgb}, ${0.08 + bass * 0.3})`;
  ctx.fillRect(0, mid - 1, w, 2);
}

/* Preset: radial orbit rings */

function drawOrbit(ctx, w, h, freq, colors, bass) {
  const cx = w / 2;
  const cy = h / 2;
  const base = Math.min(w, h) * 0.26 * (1 + bass * 0.12);
  const rings = 72;
  const bins = Math.floor(freq.length * 0.5);

  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.0038);
  ctx.lineCap = "round";

  for (let i = 0; i < rings; i++) {
    const angle = (i / rings) * Math.PI * 2;
    const bin = Math.floor((i / rings) * bins);
    const v = (freq[bin] || 0) / 255;
    const eased = v * v;
    const len = eased * Math.min(w, h) * (i % 2 ? 0.28 : 0.16);

    const x1 = Math.cos(angle) * base;
    const y1 = Math.sin(angle) * base;
    const x2 = Math.cos(angle) * (base + len);
    const y2 = Math.sin(angle) * (base + len);

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, colors.accent);
    grad.addColorStop(1, `rgba(${colors.accentRgb}, 0.05)`);
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const innerLen = eased * Math.min(w, h) * 0.06;
    ctx.strokeStyle = `rgba(${colors.accentRgb}, ${0.15 + eased * 0.5})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * (base - 4), Math.sin(angle) * (base - 4));
    ctx.lineTo(Math.cos(angle) * (base - 4 - innerLen), Math.sin(angle) * (base - 4 - innerLen));
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, w / 2 - 1, 0, Math.PI * 2);
  ctx.stroke();
}

function drawWave(ctx, w, h, time, colors, bass) {
  const mid = h / 2;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, `rgba(${colors.accentRgb}, 0.07)`);
  bg.addColorStop(0.5, "rgba(0,0,0,0)");
  bg.addColorStop(1, `rgba(${colors.accentRgb}, 0.07)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath();
    ctx.lineWidth = 2.4 - layer * 0.6;
    ctx.strokeStyle = `rgba(${colors.accentRgb}, ${0.9 - layer * 0.27})`;
    const amp = h * (0.11 + bass * (0.05 - layer * 0.015));
    const phase = performance.now() / (1200 + layer * 800);
    for (let i = 0; i < time.length; i++) {
      const v = (time[i] - 128) / 128;
      const wob = Math.sin(i * 0.014 + phase) * h * 0.02;
      const y = mid + v * amp + wob;
      const x = (i / (time.length - 1)) * w;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = `rgba(${colors.accentRgb}, 0.22)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(w, mid);
  ctx.stroke();
}

function drawParticles(ctx, w, h, freq, colors, bass) {
  if (state.modelSeed !== 1) {
    state.modelSeed = 1;
    particles.length = 0;
  }
  if (!particles.length) {
    for (let i = 0; i < 190; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: 0.6 + Math.random() * 1.9,
        speed: 20 + Math.random() * 55,
        drift: (Math.random() - 0.5) * 18,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
  }
  ctx.fillStyle = "rgba(10,10,13,0.25)";
  ctx.fillRect(0, 0, w, h);

  const speedBonus = 1 + bass * 2.4;
  const dt = 1 / 60;
  for (const p of particles) {
    p.y -= p.speed * speedBonus * dt;
    p.x += p.drift * dt;
    if (p.y < -6) {
      p.y = h + 10;
      p.x = Math.random() * w;
    }
    if (p.x < -6) p.x = w + 5;
    if (p.x > w + 6) p.x = -5;

    const alpha = 0.14 + 0.5 * (p.radius / 2.6);
    ctx.fillStyle = `rgba(${colors.accentRgb}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + bass * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const floorBars = 30;
  const bins = floorBars * 4;
  for (let i = 0; i < floorBars; i++) {
    const bin = Math.floor((i / floorBars) * bins);
    const v = (freq[bin] || 0) / 255;
    const bw = w / floorBars;
    const barH = 2 + v * v * h * 0.16;
    ctx.fillStyle = `rgba(${colors.accentRgb}, ${0.1 + v * 0.4})`;
    ctx.fillRect(i * bw + bw * 0.2, h - barH, bw * 0.6, barH);
  }
}

function drawGrid(ctx, w, h, freq, colors, time, bass) {
  const horizon = h * 0.48;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "rgba(0,0,0,0)");
  sky.addColorStop(1, `rgba(${colors.accentRgb}, 0.07)`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  const floor = ctx.createLinearGradient(0, horizon, 0, h);
  floor.addColorStop(0, `rgba(${colors.accentRgb}, 0.18)`);
  floor.addColorStop(1, `rgba(${colors.accentRgb}, 0.03)`);
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizon, w, h - horizon);

  const cols = 24;
  const bins = Math.floor(freq.length * 0.42);
  const rows = 9;
  const scroll = (time % 1);
  for (let row = 1; row <= rows; row++) {
    const frac = ((row / rows + (1 - scroll)) % 1);
    const persp = Math.pow(frac, 2.3);
    const rowY = horizon + (h - horizon) * persp;
    const rowW = w * (0.22 + 0.78 * persp);
    const margin = (w - rowW) / 2;
    for (let c = 0; c < cols; c++) {
      const bin = Math.floor((c / cols) * bins);
      const v = (freq[bin] || 0) / 255;
      const barH = Math.max(1, v * v * ((h - horizon) * persp * 0.55 + 10));
      const x = margin + (c * rowW) / cols;
      ctx.fillStyle = `rgba(${colors.accentRgb}, ${0.06 + 0.62 * persp})`;
      ctx.fillRect(x, rowY - barH, rowW / cols - 2 * (1 - persp), barH);
    }
    ctx.strokeStyle = `rgba(${colors.accentRgb}, ${0.05 + 0.2 * persp})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, rowY);
    ctx.lineTo(w - margin, rowY);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(${colors.accentRgb}, ${0.35 + bass * 0.45})`;
  ctx.fillRect(0, horizon - 1, w, 2);
}

/* ============================================================
   UI wiring
   ============================================================ */

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
    document.body.classList.toggle("nav-collapsed");
    refs.navToggle.title = document.body.classList.contains("nav-collapsed")
      ? "Expand sidebar"
      : "Collapse sidebar";
  });

  refs.sortSelect.addEventListener("change", onSortChange);
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
  refs.vizCloseBtn.addEventListener("click", closeViz);
  document.getElementById("vizPrevPreset").addEventListener("click", () => stepViz(-1));
  document.getElementById("vizNextPreset").addEventListener("click", () => stepViz(1));

  refs.settingsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSettingsPanel();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!refs.settingsPanel.hidden && !refs.settingsPanel.contains(event.target) && event.target !== refs.settingsBtn) {
      refs.settingsPanel.hidden = true;
    }
    if (refs.addMenu.hidden === false && !refs.addMenu.contains(event.target)) {
      closeRowMenu();
    }
  });
}

function toggleSettingsPanel() {
  refs.settingsPanel.hidden = !refs.settingsPanel.hidden;
  refs.settingsBtn.setAttribute("aria-expanded", String(!refs.settingsPanel.hidden));
}

function toggleHelpDialog() {
  if (refs.helpDialog.open) refs.helpDialog.close();
  else refs.helpDialog.showModal();
}

function onSearchInput() {
  state.searchTerm = refs.searchInput.value;
  renderView();
}

function onSortChange() {
  state.sortKey = refs.sortSelect.value;
  localStorage.setItem("mp_sort", state.sortKey);
  renderView();
}

function onVolumeInput() {
  state.volume = Number(refs.volumeSlider.value);
  if (refs.audio && !state.muted) refs.audio.volume = state.volume;
  state.muted = false;
  if (refs.audio) refs.audio.muted = false;
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
  if (refs.audio) refs.audio.muted = state.muted;
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
  showToast(`Shuffle ${state.shuffle ? "on" : "off"}`);
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
  const pos = VIZ_PRESETS.findIndex((p) => p.key === key);
  state.vizIndex = pos >= 0 ? pos : 0;
  localStorage.setItem("mp_viz_preset", key);
  if (state.vizOpen) renderVizHud();
}

function onKeyDown(event) {
  const tag = document.activeElement?.tagName || "";
  const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || refs.helpDialog.open;
  if (event.key === "Escape" && state.vizOpen) {
    closeViz();
    return;
  }
  if (typing) return;

  switch (event.key) {
    case " ":
      event.preventDefault();
      togglePlayback();
      break;
    case "ArrowRight":
      if (state.vizOpen) stepViz(1);
      else if (refs.audio && playerState.duration) {
        refs.audio.currentTime = Math.min(playerState.duration, refs.audio.currentTime + 5);
      } else {
        cycleRepeat();
      }
      break;
    case "ArrowLeft":
      if (state.vizOpen) stepViz(-1);
      else if (refs.audio) {
        refs.audio.currentTime = Math.max(0, refs.audio.currentTime - 5);
      }
      break;
    case "ArrowUp": {
      event.preventDefault();
      state.volume = clamp(state.volume + 0.05, 0, 1);
      state.muted = false;
      if (refs.audio) {
        refs.audio.volume = state.volume;
        refs.audio.muted = false;
      }
      refs.volumeSlider.value = String(state.volume);
      localStorage.setItem("mp_volume", String(state.volume));
      refreshVolumeControls();
      break;
    }
    case "ArrowDown": {
      event.preventDefault();
      state.volume = clamp(state.volume - 0.05, 0, 1);
      refs.volumeSlider.value = String(state.volume);
      localStorage.setItem("mp_volume", String(state.volume));
      if (refs.audio) refs.audio.volume = state.volume;
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
