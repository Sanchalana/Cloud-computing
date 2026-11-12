"use strict";

const STORAGE_KEY = "iot-image-gallery-demo-v1";
const sampleImages = [
  { id: "sample-01", name: "Garden visitor", image: "assets/sample-garden.svg", time: "2026-10-14T09:42:00", type: "sample" },
  { id: "sample-02", name: "Front porch", image: "assets/sample-porch.svg", time: "2026-10-14T08:16:00", type: "sample" },
  { id: "sample-03", name: "Window light", image: "assets/sample-window.svg", time: "2026-10-13T18:24:00", type: "sample" },
  { id: "sample-04", name: "Backyard path", image: "assets/sample-path.svg", time: "2026-10-13T16:51:00", type: "sample" },
  { id: "sample-05", name: "Evening sky", image: "assets/sample-evening.svg", time: "2026-10-12T19:05:00", type: "sample" },
  { id: "sample-06", name: "Garden flowers", image: "assets/sample-flowers.svg", time: "2026-10-12T11:33:00", type: "sample" }
];

const gallery = document.querySelector("#gallery");
const emptyState = document.querySelector("#empty-state");
const activityList = document.querySelector("#activity-list");
const previewDialog = document.querySelector("#preview-dialog");
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      captures: Array.isArray(saved.captures) ? saved.captures : [],
      deletedSamples: Array.isArray(saved.deletedSamples) ? saved.deletedSamples : [],
      activity: Array.isArray(saved.activity) ? saved.activity : []
    };
  } catch (error) {
    console.warn("Could not read saved demo state; starting fresh.", error);
    return { captures: [], deletedSamples: [], activity: [] };
  }
}

let state = readState();
let layoutIsList = false;
let ledTimer;
let toastTimer;

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    showToast("Browser storage is unavailable; this change may not persist.", "error");
    console.error("Could not save demo state.", error);
  }
}

function allImages() {
  const removed = new Set(state.deletedSamples);
  return [
    ...state.captures,
    ...sampleImages.filter((image) => !removed.has(image.id))
  ].sort((a, b) => new Date(b.time) - new Date(a.time));
}

function timeAgo(date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return dateFormatter.format(date);
}

function safeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function addActivity(title, detail, kind = "system", time = new Date().toISOString()) {
  state.activity.unshift({ title, detail, kind, time });
  state.activity = state.activity.slice(0, 8);
}

function renderStats(images) {
  const today = new Date();
  const isToday = (item) => {
    const date = safeDate(item.time);
    return date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
  };
  const latest = images[0];
  document.querySelector("#total-images").textContent = String(images.length);
  document.querySelector("#today-uploads").textContent = String(images.filter(isToday).length);
  document.querySelector("#nav-image-count").textContent = String(images.length);
  document.querySelector("#gallery-count").textContent = String(images.length);
  document.querySelector("#last-capture").textContent = latest ? timeFormatter.format(safeDate(latest.time)) : "—";
  document.querySelector("#last-capture-date").textContent = latest ? dateFormatter.format(safeDate(latest.time)) : "Waiting for event";
}

function makeButton(label, className, onClick, title = label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.title = title;
  button.addEventListener("click", onClick);
  return button;
}

function showPreview(image) {
  document.querySelector("#preview-image").src = image.image;
  document.querySelector("#preview-image").alt = image.name;
  document.querySelector("#preview-title").textContent = image.name;
  document.querySelector("#preview-date").textContent = safeDate(image.time).toLocaleString();
  previewDialog.showModal();
}

function downloadImage(image) {
  const anchor = document.createElement("a");
  anchor.href = image.image;
  anchor.download = `${image.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  showToast(`Downloaded ${image.name}.`, "success");
}

function deleteImage(image) {
  const confirmed = window.confirm(`Remove "${image.name}" from this demo gallery?`);
  if (!confirmed) return;
  if (image.type === "sample") state.deletedSamples.push(image.id);
  else state.captures = state.captures.filter((item) => item.id !== image.id);
  addActivity("Image removed", `${image.name} removed from local demo`, "system");
  persist();
  render();
  showToast("Image removed from the local gallery.", "success");
}

function createCard(image) {
  const card = document.createElement("article");
  card.className = "image-card";
  const thumb = document.createElement("div");
  thumb.className = "image-thumb";
  thumb.setAttribute("role", "button");
  thumb.setAttribute("tabindex", "0");
  thumb.setAttribute("aria-label", `Open ${image.name} in full screen`);
  const img = document.createElement("img");
  img.src = image.image;
  img.alt = image.name;
  img.loading = "lazy";
  thumb.append(img);
  const badge = document.createElement("span");
  badge.className = "image-badge";
  badge.textContent = image.type === "sample" ? "SAMPLE" : "CAPTURED";
  thumb.append(badge);
  thumb.addEventListener("click", () => showPreview(image));
  thumb.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showPreview(image);
    }
  });

  const info = document.createElement("div");
  info.className = "image-info";
  const title = document.createElement("h3");
  title.className = "image-title";
  title.textContent = image.name;
  title.title = image.name;
  const meta = document.createElement("div");
  meta.className = "image-meta";
  const date = document.createElement("span");
  const timestamp = safeDate(image.time);
  date.textContent = `${dateFormatter.format(timestamp)} · ${timeFormatter.format(timestamp)}`;
  const source = document.createElement("span");
  source.textContent = image.type === "sample" ? "Demo" : "Local";
  meta.append(date, source);
  const status = document.createElement("div");
  status.className = "image-status";
  status.innerHTML = "<span aria-hidden=\"true\">●</span> Ready · local demo";
  const actions = document.createElement("div");
  actions.className = "image-actions";
  actions.append(
    makeButton("View", "view-image", () => showPreview(image)),
    makeButton("Download", "download-image", () => downloadImage(image)),
    makeButton("×", "delete-image", () => deleteImage(image), "Delete image")
  );
  info.append(title, meta, status, actions);
  card.append(thumb, info);
  return card;
}

function renderActivity() {
  activityList.replaceChildren();
  const entries = state.activity.length ? state.activity : [
    { title: "Demo gallery ready", detail: "Sample images loaded in this browser", kind: "system", time: new Date().toISOString() },
    { title: "Cloud services offline", detail: "AWS is not configured in this demo", kind: "system", time: new Date().toISOString() }
  ];
  entries.slice(0, 5).forEach((entry) => {
    const row = document.createElement("div");
    row.className = "activity-row";
    const icon = document.createElement("span");
    icon.className = `activity-icon ${entry.kind === "capture" ? "capture" : entry.kind === "upload" ? "upload" : "system"}`;
    icon.textContent = entry.kind === "capture" ? "◉" : entry.kind === "upload" ? "↥" : "✦";
    const copy = document.createElement("div");
    copy.className = "activity-copy";
    const title = document.createElement("strong");
    title.textContent = entry.title;
    const detail = document.createElement("small");
    detail.textContent = entry.detail;
    copy.append(title, detail);
    const timestamp = document.createElement("time");
    timestamp.className = "activity-time";
    timestamp.dateTime = entry.time;
    timestamp.textContent = timeAgo(safeDate(entry.time));
    row.append(icon, copy, timestamp);
    activityList.append(row);
  });
}

function render() {
  const images = allImages();
  const query = document.querySelector("#search-input").value.trim().toLowerCase();
  const filter = document.querySelector("#filter-select").value;
  const filtered = images.filter((image) => {
    const matchesQuery = `${image.name} ${image.type}`.toLowerCase().includes(query);
    const date = safeDate(image.time);
    const now = new Date();
    const matchesFilter = filter === "all"
      || (filter === "demo" && image.type === "sample")
      || (filter === "captured" && image.type !== "sample")
      || (filter === "today" && date.toDateString() === now.toDateString());
    return matchesQuery && matchesFilter;
  });
  gallery.replaceChildren(...filtered.map(createCard));
  gallery.classList.toggle("list-layout", layoutIsList);
  emptyState.classList.toggle("hidden", filtered.length !== 0);
  document.querySelector("#gallery-summary").textContent = `Showing ${filtered.length} of ${images.length} images`;
  renderStats(images);
  renderActivity();
}

function showToast(message, kind = "") {
  const region = document.querySelector("#toast-region");
  const toast = document.createElement("div");
  toast.className = `toast ${kind}`;
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

function captureImage() {
  const sample = sampleImages[Math.floor(Math.random() * sampleImages.length)];
  const now = new Date();
  const image = {
    id: `capture-${now.getTime()}-${Math.random().toString(16).slice(2, 7)}`,
    name: `Capture ${timeFormatter.format(now)}`,
    image: sample.image,
    time: now.toISOString(),
    type: "capture"
  };
  state.captures.unshift(image);
  addActivity("Capture event registered", `${image.name} · simulated ESP32 button`, "capture", now.toISOString());
  persist();
  render();
  const led = document.querySelector("#led-indicator");
  led.classList.add("on");
  document.querySelector("#led-label").textContent = "Registered";
  window.clearTimeout(ledTimer);
  ledTimer = window.setTimeout(() => {
    led.classList.remove("on");
    document.querySelector("#led-label").textContent = "Idle";
  }, 1800);
  showToast("Capture registered — a demo image was added to your gallery.", "success");
}

document.querySelector("#capture-button").addEventListener("click", captureImage);
document.querySelector("#device-capture").addEventListener("click", captureImage);
document.querySelector("#empty-capture").addEventListener("click", captureImage);
document.querySelector("#search-input").addEventListener("input", render);
document.querySelector("#filter-select").addEventListener("change", render);
document.querySelector("#view-toggle").addEventListener("click", (event) => {
  layoutIsList = !layoutIsList;
  event.currentTarget.textContent = layoutIsList ? "☷" : "▦";
  event.currentTarget.setAttribute("aria-label", layoutIsList ? "Switch to grid layout" : "Switch to list layout");
  render();
});
document.querySelector("#close-preview").addEventListener("click", () => previewDialog.close());
previewDialog.addEventListener("click", (event) => {
  if (event.target === previewDialog) previewDialog.close();
});
document.querySelector("#menu-toggle").addEventListener("click", () => {
  document.querySelector("#sidebar").classList.toggle("open");
});
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelector("#sidebar").classList.remove("open");
    document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    captureImage();
  }
});

render();