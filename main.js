const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const themeToggle = document.querySelector('#theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
themeToggle?.setAttribute('aria-keyshortcuts', ',');

function setTheme(theme, persist = true) {
  const selectedTheme = theme === 'light' ? 'light' : 'dark';
  const lightMode = selectedTheme === 'light';
  document.documentElement.dataset.theme = selectedTheme;
  themeToggle?.setAttribute('aria-pressed', String(lightMode));
  themeToggle?.setAttribute('aria-label', lightMode ? 'Switch to dark theme' : 'Switch to light theme');
  const label = themeToggle?.querySelector('.theme-toggle-label');
  const icon = themeToggle?.querySelector('.theme-toggle-icon');
  if (label) label.textContent = lightMode ? 'DARK' : 'LIGHT';
  if (icon) icon.textContent = lightMode ? '☾' : '☼';
  if (themeColor) themeColor.content = lightMode ? '#f2f0ec' : '#0b0b0f';
  if (persist) {
    try { localStorage.setItem('hyde-theme', selectedTheme); } catch { /* Storage can be disabled by the browser. */ }
  }
}

setTheme(document.documentElement.dataset.theme, false);
themeToggle?.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

const intro = document.querySelector('#boot-intro');
const replayIntro = document.querySelector('#replay-intro');
const introDismissers = [...document.querySelectorAll('[data-dismiss-intro]')];
let focusBeforeIntro = null;
let introTimer;

function closeIntro() {
  if (!intro || intro.hidden) return;
  intro.classList.remove('is-active');
  document.body.classList.remove('intro-open');
  window.clearTimeout(introTimer);
  introTimer = window.setTimeout(() => { intro.hidden = true; }, reducedMotion ? 0 : 260);
  try { localStorage.setItem('hyde-intro-seen', 'true'); } catch { /* Intro remains replayable when storage is disabled. */ }
  if (focusBeforeIntro && focusBeforeIntro !== document.body) focusBeforeIntro.focus();
}

function openIntro() {
  if (!intro) return;
  focusBeforeIntro = document.activeElement;
  window.clearTimeout(introTimer);
  intro.hidden = false;
  document.body.classList.add('intro-open');
  requestAnimationFrame(() => intro.classList.add('is-active'));
  intro.querySelector('.boot-close')?.focus();
}

introDismissers.forEach((button) => button.addEventListener('click', closeIntro));
replayIntro?.addEventListener('click', openIntro);
document.addEventListener('keydown', (event) => {
  if (!intro || intro.hidden) return;
  if (event.key === 'Escape') closeIntro();
  if (event.key === 'Enter' && !['BUTTON', 'A'].includes(event.target.tagName)) closeIntro();
  if (event.key === 'Tab') {
    const focusables = [...intro.querySelectorAll('button:not([disabled])')];
    if (event.shiftKey && document.activeElement === focusables[0]) {
      event.preventDefault();
      focusables.at(-1)?.focus();
    } else if (!event.shiftKey && document.activeElement === focusables.at(-1)) {
      event.preventDefault();
      focusables[0]?.focus();
    }
  }
});
try {
  if (!localStorage.getItem('hyde-intro-seen')) window.setTimeout(openIntro, 180);
} catch {
  window.setTimeout(openIntro, 180);
}

const desktopView = document.querySelector('#desktop-view');
const contentBank = document.querySelector('#content-bank');
let revealObserver;
const sharedContent = {
  home: [contentBank?.querySelector('.hero-copy')],
  terminal: [contentBank?.querySelector('.hero-terminal')],
  projects: [contentBank?.querySelector('#work')],
  profile: [contentBank?.querySelector('.about-copy')],
  tools: [contentBank?.querySelector('.toolkit')],
  activity: [contentBank?.querySelector('.github-preview')]
};

function mountSharedContent() {
  Object.entries(sharedContent).forEach(([key, nodes]) => {
    const host = desktopView?.querySelector(`[data-mount="${key}"]`);
    nodes.filter(Boolean).forEach((node) => host?.append(node));
  });
}

let desktopSpace = 'home';
let focusedWindow = 'home';
let desktopLayout = 'overview';
const paneWidths = { home: 6, terminal: 6, projects: 10, profile: 6, activity: 6, contact: 8 };
const paneHeights = { homePair: 4, profilePair: 7, contact: 6 };
const taskIcons = { home: '◉', terminal: '>_', projects: '▣', profile: '⌂', activity: '⌁', contact: '@' };
const taskNames = { home: 'HOME', terminal: 'SHELL', projects: 'WORK', profile: 'PROFILE', activity: 'GITHUB', contact: 'CONTACT' };
const desktopWindowState = Object.fromEntries(
  [...document.querySelectorAll('.desktop-window')].map((windowNode) => [windowNode.dataset.window, { open: true, minimized: false }])
);

function renderDesktop() {
  if (!desktopView) return;
  desktopView.dataset.space = desktopSpace;
  desktopView.dataset.focusWindow = focusedWindow;
  const desktopCanvas = desktopView.querySelector('.desktop-canvas');
  if (desktopCanvas) {
    desktopCanvas.dataset.layout = desktopLayout;
    desktopCanvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Space Q F , = + - Shift+= Shift+-');
  }
  applyPaneWidths();
  applyPaneHeights();
  const windows = [...desktopView.querySelectorAll('.desktop-window')];
  windows.forEach((windowNode, index) => {
    const id = windowNode.dataset.window;
    const state = desktopWindowState[id];
    windowNode.tabIndex = -1;
    windowNode.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Q F = + - Shift+= Shift+-');
    windowNode.querySelector('[data-window-action="close"]')?.setAttribute('aria-keyshortcuts', 'Q');
    const visible = state?.open && !state.minimized && windowNode.dataset.space === desktopSpace;
    windowNode.hidden = !visible;
    windowNode.classList.toggle('focused', id === focusedWindow && visible);
    windowNode.style.zIndex = String(id === focusedWindow ? windows.length + 1 : index + 1);
  });

  if (mobileLayoutQuery.matches) {
    const activeWindow = windows.find((windowNode) => windowNode.dataset.window === focusedWindow);
    activeWindow?.querySelectorAll('.reveal').forEach((item) => {
      item.classList.add('is-visible');
      item.style.removeProperty('opacity');
      item.style.removeProperty('transform');
      item.style.visibility = 'visible';
    });
  }

  const taskbar = desktopView.querySelector('#desktop-taskbar');
  const tasks = windows.filter((windowNode) => windowNode.dataset.space === desktopSpace && desktopWindowState[windowNode.dataset.window]?.open);
  taskbar?.replaceChildren(...tasks.map((windowNode) => {
    const id = windowNode.dataset.window;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `desktop-task${desktopWindowState[id].minimized ? ' is-minimized' : ''}${id === focusedWindow ? ' is-focused' : ''}`;
    button.dataset.restoreWindow = id;
    button.setAttribute('aria-label', `Focus or restore ${id} window`);
    button.setAttribute('aria-pressed', String(id === focusedWindow && !desktopWindowState[id].minimized));
    button.title = taskNames[id];
    const icon = document.createElement('span');
    icon.className = 'desktop-task-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = taskIcons[id];
    const label = document.createElement('span');
    label.className = 'desktop-task-label';
    label.textContent = taskNames[id];
    button.append(icon, label);
    return button;
  }));

  desktopView.querySelectorAll('[data-desktop-space]').forEach((button) => {
    if (!button.matches('button')) return;
    const selected = button.dataset.desktopSpace === desktopSpace;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  desktopView.querySelectorAll('[data-open-window]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.openWindow === focusedWindow));
  });
}

const taskbarClock = desktopView?.querySelector('#desktop-clock');
const taskbarDate = desktopView?.querySelector('#desktop-date');
let taskbarClockTimer = 0;

function updateTaskbarClock() {
  if (!taskbarClock || !taskbarDate) return;
  const now = new Date();
  taskbarClock.dateTime = now.toISOString();
  taskbarClock.textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(now);
  taskbarDate.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(now);
  window.clearTimeout(taskbarClockTimer);
  if (!document.hidden) taskbarClockTimer = window.setTimeout(updateTaskbarClock, 60_000 - (Date.now() % 60_000) + 40);
}

updateTaskbarClock();
document.addEventListener('visibilitychange', updateTaskbarClock);

const mobileWindowDock = desktopView?.querySelector('.desktop-mobile-dock');
const desktopRail = desktopView?.querySelector('.desktop-rail');
const mobileRailControls = desktopRail?.querySelector('.rail-controls');
const desktopControlsReturnPoint = mobileRailControls?.nextSibling || null;
const mobileLayoutQuery = window.matchMedia('(max-width: 700px)');

function placeSettingsForViewport() {
  if (!mobileRailControls || !desktopRail || !mobileWindowDock) return;
  if (mobileLayoutQuery.matches) {
    mobileWindowDock.append(mobileRailControls);
    return;
  }
  desktopRail.insertBefore(mobileRailControls, desktopControlsReturnPoint?.parentNode === desktopRail ? desktopControlsReturnPoint : null);
}

placeSettingsForViewport();
const handleMobileLayoutChange = () => {
  placeSettingsForViewport();
  renderDesktop();
};
if (typeof mobileLayoutQuery.addEventListener === 'function') {
  mobileLayoutQuery.addEventListener('change', handleMobileLayoutChange);
} else if (typeof mobileLayoutQuery.addListener === 'function') {
  mobileLayoutQuery.addListener(handleMobileLayoutChange);
}

function switchDesktopSpace(space) {
  if (!['home', 'profile', 'contact'].includes(space)) return;
  desktopSpace = space;
  const spaceWindows = [...desktopView.querySelectorAll('.desktop-window')].filter((windowNode) => windowNode.dataset.space === space);
  const firstWindow = spaceWindows.find((windowNode) => desktopWindowState[windowNode.dataset.window]?.open && !desktopWindowState[windowNode.dataset.window]?.minimized) || spaceWindows[0];
  if (firstWindow) {
    desktopWindowState[firstWindow.dataset.window] = { open: true, minimized: false };
    focusedWindow = firstWindow.dataset.window;
  }
  renderDesktop();
}

function applyPaneWidths() {
  const pairedPanes = [['home', 'terminal'], ['profile', 'activity']];
  pairedPanes.forEach(([leftId, rightId]) => {
    const leftWidth = paneWidths[leftId];
    const left = desktopView?.querySelector(`[data-window="${leftId}"]`);
    const right = desktopView?.querySelector(`[data-window="${rightId}"]`);
    if (!left || !right) return;
    left.style.gridColumn = `1 / ${leftWidth + 1}`;
    right.style.gridColumn = `${leftWidth + 1} / 13`;
  });
  [['projects', 10], ['contact', 8]].forEach(([id, baseWidth]) => {
    const node = desktopView?.querySelector(`[data-window="${id}"]`);
    if (!node) return;
    const width = paneWidths[id];
    const start = Math.floor((12 - width) / 2) + 1;
    if (width === baseWidth) node.style.removeProperty('grid-column');
    else node.style.gridColumn = `${start} / ${start + width}`;
  });
}

function applyPaneHeights() {
  const setRow = (id, start, end) => {
    const node = desktopView?.querySelector(`[data-window="${id}"]`);
    if (node) node.style.gridRow = `${start} / ${end}`;
  };
  const upperEnd = paneHeights.homePair + 1;
  setRow('home', 1, upperEnd);
  setRow('terminal', 1, upperEnd);
  setRow('projects', upperEnd, 11);

  const profileEnd = paneHeights.profilePair + 1;
  setRow('profile', 1, profileEnd);
  setRow('activity', 1, profileEnd);

  const contactStart = Math.max(1, Math.ceil((10 - paneHeights.contact) / 2));
  const contact = desktopView?.querySelector('[data-window="contact"]');
  if (contact) {
    contact.style.gridRow = `${contactStart} / ${contactStart + paneHeights.contact}`;
    contact.style.alignSelf = 'stretch';
  }
}

function availableWindows() {
  return [...desktopView.querySelectorAll('.desktop-window')].filter((node) =>
    node.dataset.space === desktopSpace && desktopWindowState[node.dataset.window]?.open && !desktopWindowState[node.dataset.window]?.minimized
  );
}

function focusWindow(id, moveFocus = true) {
  const node = desktopView?.querySelector(`[data-window="${id}"]`);
  if (!node) return;
  desktopSpace = node.dataset.space;
  desktopWindowState[id] = { open: true, minimized: false };
  focusedWindow = id;
  renderDesktop();
  if (moveFocus) node.focus({ preventScroll: true });
}

function closeWindow(id = focusedWindow) {
  const node = desktopView?.querySelector(`[data-window="${id}"]`);
  if (!node || !desktopWindowState[id]?.open) return;
  desktopWindowState[id] = { open: false, minimized: false };
  if (focusedWindow === id) {
    const remaining = availableWindows()[0];
    if (remaining) focusedWindow = remaining.dataset.window;
  }
  renderDesktop();
  const replacement = desktopView?.querySelector(`[data-window="${focusedWindow}"]`);
  replacement?.focus({ preventScroll: true });
}

function moveWindowFocus(direction) {
  const candidates = availableWindows();
  if (candidates.length < 2) return;
  const current = desktopView.querySelector(`[data-window="${focusedWindow}"]`);
  const currentRect = current?.getBoundingClientRect();
  const vector = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[direction];
  if (currentRect && !mobileLayoutQuery.matches && desktopLayout !== 'focus') {
    const cx = currentRect.left + currentRect.width / 2;
    const cy = currentRect.top + currentRect.height / 2;
    const [vx, vy] = vector;
    const directional = candidates.filter((node) => node !== current).map((node) => {
      const rect = node.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - cx;
      const dy = rect.top + rect.height / 2 - cy;
      const primary = dx * vx + dy * vy;
      const cross = Math.abs(dx * -vy + dy * vx);
      return { node, primary, cross };
    }).filter((item) => item.primary > 0).sort((a, b) => a.primary + a.cross * 1.5 - (b.primary + b.cross * 1.5));
    if (directional.length) {
      focusWindow(directional[0].node.dataset.window);
      return;
    }
  }
  const allWindows = [...desktopView.querySelectorAll('.desktop-window')].filter((node) => node.dataset.space === desktopSpace);
  const currentIndex = allWindows.findIndex((node) => node.dataset.window === focusedWindow);
  const step = direction === 'ArrowLeft' || direction === 'ArrowUp' ? -1 : 1;
  for (let offset = 1; offset <= allWindows.length; offset += 1) {
    const candidate = allWindows[(currentIndex + step * offset + allWindows.length) % allWindows.length];
    if (desktopWindowState[candidate.dataset.window]?.open && !desktopWindowState[candidate.dataset.window]?.minimized) {
      focusWindow(candidate.dataset.window);
      return;
    }
  }
}

function resizeFocusedWindow(delta) {
  const id = focusedWindow;
  const pair = { home: 'terminal', terminal: 'home', profile: 'activity', activity: 'profile' };
  const partner = pair[id];
  if (partner) {
    const leftId = id === 'home' || id === 'profile' ? id : partner;
    const rightId = id === 'terminal' || id === 'activity' ? id : partner;
    const currentLeft = paneWidths[leftId];
    const step = (id === leftId ? delta : -delta);
    const nextLeft = Math.max(3, Math.min(9, currentLeft + step));
    paneWidths[leftId] = nextLeft;
    paneWidths[rightId] = 12 - nextLeft;
  } else if (id === 'projects' || id === 'contact') {
    paneWidths[id] = Math.max(6, Math.min(12, paneWidths[id] + delta));
  }
  applyPaneWidths();
}

function resizeFocusedWindowHeight(delta) {
  if (mobileLayoutQuery.matches) return;
  const id = focusedWindow;
  if (['home', 'terminal', 'projects'].includes(id)) {
    const direction = id === 'projects' ? -delta : delta;
    paneHeights.homePair = Math.max(3, Math.min(8, paneHeights.homePair + direction));
  } else if (id === 'profile' || id === 'activity') {
    paneHeights.profilePair = Math.max(3, Math.min(10, paneHeights.profilePair + delta));
  } else if (id === 'contact') {
    paneHeights.contact = Math.max(3, Math.min(10, paneHeights.contact + delta));
  }
  applyPaneHeights();
}

const launcher = desktopView?.querySelector('#window-launcher');
const launcherInput = desktopView?.querySelector('#window-search');
const launcherOptions = desktopView?.querySelector('#launcher-options');
let launcherIndex = 0;
let launcherReturnFocus = null;

function renderLauncherOptions(query = '') {
  if (!launcherOptions) return;
  const normalized = query.trim().toLowerCase();
  const names = { home: 'about.txt', terminal: 'terminal', projects: 'projects/', profile: 'education.log', activity: 'github activity', contact: 'contact.sh' };
  const matches = [...desktopView.querySelectorAll('.desktop-window')].filter((node) => `${names[node.dataset.window]} ${node.dataset.window}`.toLowerCase().includes(normalized));
  launcherIndex = Math.min(launcherIndex, Math.max(matches.length - 1, 0));
  launcherOptions.replaceChildren(...matches.map((node, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'option';
    button.dataset.launchWindow = node.dataset.window;
    button.dataset.launchIndex = String(index);
    button.setAttribute('aria-selected', String(index === launcherIndex));
    button.innerHTML = `<span class="launcher-option-icon" aria-hidden="true">${desktopWindowState[node.dataset.window]?.open ? '▣' : '＋'}</span><span>${names[node.dataset.window]}</span><small>${node.dataset.space}</small>`;
    return button;
  }));
  const active = launcherOptions.querySelector(`[data-launch-index="${launcherIndex}"]`);
  launcherInput?.setAttribute('aria-activedescendant', active ? `launcher-option-${launcherIndex}` : '');
  launcherOptions.querySelectorAll('[data-launch-index]').forEach((button) => { button.id = `launcher-option-${button.dataset.launchIndex}`; });
  launcherOptions.setAttribute('aria-label', matches.length ? `${matches.length} matching windows` : 'No matching windows');
}

function openLauncher() {
  if (!launcher) return;
  launcherReturnFocus = document.activeElement;
  launcher.hidden = false;
  launcherIndex = 0;
  if (launcherInput) launcherInput.value = '';
  renderLauncherOptions();
  launcherInput?.focus({ preventScroll: true });
}

function closeLauncher(restoreFocus = true) {
  if (!launcher || launcher.hidden) return;
  launcher.hidden = true;
  if (restoreFocus && launcherReturnFocus instanceof HTMLElement && launcherReturnFocus.isConnected) launcherReturnFocus.focus({ preventScroll: true });
}

function launchWindow(id) {
  closeLauncher(false);
  focusWindow(id);
}

launcherInput?.addEventListener('input', () => {
  launcherIndex = 0;
  renderLauncherOptions(launcherInput.value);
});
launcher?.querySelector('[data-close-launcher]')?.addEventListener('click', () => closeLauncher());
desktopView?.querySelector('[data-open-launcher]')?.addEventListener('click', openLauncher);

document.querySelectorAll('a[href="#work"]').forEach((link) => {
  link.addEventListener('click', () => {
    desktopSpace = 'home';
    desktopWindowState.projects = { open: true, minimized: false };
    focusedWindow = 'projects';
    renderDesktop();
  });
});

desktopView?.addEventListener('click', (event) => {
  if (launcher && !launcher.hidden && !event.target.closest('.window-launcher')) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const actionButton = event.target.closest('[data-window-action]');
  const windowNode = event.target.closest('.desktop-window');
  if (actionButton && windowNode) {
    const state = desktopWindowState[windowNode.dataset.window];
    if (actionButton.dataset.windowAction === 'minimize') state.minimized = true;
    if (actionButton.dataset.windowAction === 'close') state.open = false;
    if (focusedWindow === windowNode.dataset.window) {
      const replacement = [...desktopView.querySelectorAll('.desktop-window')].find((candidate) => candidate !== windowNode && candidate.dataset.space === desktopSpace && desktopWindowState[candidate.dataset.window]?.open && !desktopWindowState[candidate.dataset.window]?.minimized);
      if (replacement) focusedWindow = replacement.dataset.window;
    }
    renderDesktop();
    return;
  }

  const restoreButton = event.target.closest('[data-restore-window]');
  const openButton = event.target.closest('[data-open-window]');
  const launchButton = event.target.closest('[data-launch-window]');
  if (launchButton) {
    launchWindow(launchButton.dataset.launchWindow);
    return;
  }
  const id = restoreButton?.dataset.restoreWindow || openButton?.dataset.openWindow;
  if (id) {
    focusWindow(id);
    return;
  }
  if (windowNode) {
    focusedWindow = windowNode.dataset.window;
    renderDesktop();
  }
  const spaceButton = event.target.closest('button[data-desktop-space]');
  if (spaceButton) switchDesktopSpace(spaceButton.dataset.desktopSpace);
});

document.body.dataset.portfolioMode = 'desktop';
mountSharedContent();
renderDesktop();
window.requestAnimationFrame(() => {
  desktopView?.querySelectorAll('.reveal').forEach((item) => {
    if (reducedMotion) item.classList.add('is-visible');
    else revealObserver?.observe(item);
  });
});

const crtCanvas = document.querySelector('#crt-refresh');
const crtScreen = document.querySelector('.desktop-canvas');
const crtContext = crtCanvas?.getContext('2d', { alpha: true });
const monitorFrameDuration = 1000 / 60;
let monitorFrameRequest = 0;
let lastMonitorFrame = null;
let monitorFrameAccumulator = 0;
let crtWidth = 0;
let crtHeight = 0;
let monitorPointer = null;
let monitorCursorClickAt = -Infinity;
const monitorJobs = new Set();
const monitorParticles = new Set();
const monitorFlashes = new Map();

function addMonitorJob(job) {
  monitorJobs.add(job);
  return () => monitorJobs.delete(job);
}

function monitorTween(duration, update, complete) {
  let elapsed = 0;
  const cancel = addMonitorJob((delta) => {
    elapsed += delta;
    const progress = Math.min(elapsed / duration, 1);
    update(progress);
    if (progress < 1) return;
    cancel();
    complete?.();
  });
  return cancel;
}

function monitorTimeout(callback, delay) {
  let remaining = delay;
  const cancel = addMonitorJob((delta) => {
    remaining -= delta;
    if (remaining > 0) return;
    cancel();
    callback();
  });
  return cancel;
}

function monitorTypeText(element, text, interval, complete, reverse = false) {
  let elapsed = 0;
  let index = reverse ? text.length : 0;
  element.textContent = reverse ? text : '';
  const cancel = addMonitorJob((delta) => {
    elapsed += delta;
    while (elapsed >= interval && (reverse ? index > 0 : index < text.length)) {
      elapsed -= interval;
      index += reverse ? -1 : 1;
      element.textContent = text.slice(0, index);
    }
    if (reverse ? index > 0 : index < text.length) return;
    cancel();
    complete?.();
  });
  return cancel;
}

function resizeCrtCanvas() {
  if (!crtCanvas || !crtContext || !crtScreen) return;
  const bounds = crtScreen.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  crtWidth = bounds.width;
  crtHeight = bounds.height;
  crtCanvas.width = Math.round(crtWidth * scale);
  crtCanvas.height = Math.round(crtHeight * scale);
  crtContext.setTransform(scale, 0, 0, scale, 0, 0);
}

function drawCrtRefresh(timestamp) {
  if (!crtContext || !crtWidth || !crtHeight) return;
  crtContext.clearRect(0, 0, crtWidth, crtHeight);
  const sweepY = (timestamp % 4200) / 4200 * crtHeight;
  const band = crtContext.createLinearGradient(0, sweepY - 34, 0, sweepY + 34);
  band.addColorStop(0, 'rgba(147, 239, 176, 0)');
  band.addColorStop(0.42, 'rgba(147, 239, 176, 0.018)');
  band.addColorStop(0.5, 'rgba(181, 255, 203, 0.065)');
  band.addColorStop(0.58, 'rgba(147, 239, 176, 0.018)');
  band.addColorStop(1, 'rgba(147, 239, 176, 0)');
  crtContext.fillStyle = band;
  crtContext.fillRect(0, sweepY - 34, crtWidth, 68);
}

const monitorCaretNodes = [...(crtScreen?.querySelectorAll('.blink, .type-caret, .command-caret') || [])];
const monitorTiltTargets = [...(crtScreen?.querySelectorAll('.hero-terminal, .github-preview') || [])];
const monitorSpotTargets = [...(crtScreen?.querySelectorAll('.project-option') || [])];

function updateMonitorEffects(timestamp, delta) {
  drawCrtRefresh(timestamp);

  if (cursorSupported && monitorPointer?.inScreen && !monitorPointer.isTyping) {
    const { x, y, hovering } = monitorPointer;
    cursorOutside.classList.remove('is-visible', 'is-hovering');
    cursorInside.style.left = `${x}px`;
    cursorInside.style.top = `${y}px`;
    cursorInside.classList.add('is-visible');
    cursorInside.classList.toggle('is-hovering', hovering);
    const shape = cursorInside.querySelector('.cursor-shape');
    if (shape) {
      const clickAge = timestamp - monitorCursorClickAt;
      if (clickAge >= 0 && clickAge < 300) {
        const progress = clickAge / 300;
        const tap = Math.sin(progress * Math.PI * 2);
        shape.style.transform = `scale(${1 - 0.12 * Math.sin(progress * Math.PI)}) rotate(${tap * 5}deg)`;
      } else {
        shape.style.transform = hovering ? 'scale(1.06) rotate(-3deg)' : 'none';
      }
    }
    } else if (cursorInside) {
    cursorInside.classList.remove('is-visible', 'is-hovering');
      if (monitorPointer?.inScreen) cursorOutside.classList.remove('is-visible', 'is-hovering');
  }

  const caretVisible = Math.floor(timestamp / 450) % 2 === 0 ? '1' : '0';
  monitorCaretNodes.forEach((node) => { node.style.opacity = caretVisible; });

  monitorTiltTargets.forEach((target) => {
    if (!target.dataset.pointerTilt) return;
    target.style.setProperty('--tilt-x', `${target.dataset.tiltX || 0}deg`);
    target.style.setProperty('--tilt-y', `${target.dataset.tiltY || 0}deg`);
    target.style.setProperty('--spot-x', target.dataset.spotX || '50%');
    target.style.setProperty('--spot-y', target.dataset.spotY || '20%');
  });
  monitorSpotTargets.forEach((target) => {
    if (!target.dataset.spotX) return;
    target.style.setProperty('--mx', target.dataset.spotX);
    target.style.setProperty('--my', target.dataset.spotY || '0px');
  });

  [...monitorParticles].forEach((particle) => {
    const age = timestamp - particle.startedAt - particle.delay;
    if (age < 0) return;
    const progress = Math.min(age / particle.duration, 1);
    const eased = 1 - (1 - progress) ** 3;
    const scale = progress < 0.15 ? 0.25 + (progress / 0.15) * 0.85 : 1.1 - (progress - 0.15) * 0.53;
    const opacity = progress < 0.15 ? progress / 0.15 : 1 - (progress - 0.15) / 0.85;
    particle.node.style.opacity = String(Math.max(0, opacity));
    particle.node.style.transform = `translate(calc(-50% + ${particle.dx * eased}px), calc(-50% + ${particle.dy * eased}px)) rotate(${particle.spin * eased}deg) scale(${scale})`;
    if (progress >= 1) {
      particle.node.remove();
      monitorParticles.delete(particle);
    }
  });

  [...monitorFlashes].forEach(([target, flash]) => {
    const progress = Math.min((timestamp - flash.startedAt) / flash.duration, 1);
    target.style.filter = `brightness(${1 + Math.sin(progress * Math.PI) * 0.24})`;
    if (progress >= 1) {
      target.style.removeProperty('filter');
      monitorFlashes.delete(target);
    }
  });

  [...monitorJobs].forEach((job) => job(delta, timestamp));
}

function runMonitorFrame(timestamp) {
  monitorFrameRequest = 0;
  if (document.hidden || reducedMotion || !crtCanvas?.isConnected) return;
  if (lastMonitorFrame === null) {
    lastMonitorFrame = timestamp;
    monitorFrameAccumulator = monitorFrameDuration;
  } else {
    monitorFrameAccumulator += timestamp - lastMonitorFrame;
    lastMonitorFrame = timestamp;
  }
  if (monitorFrameAccumulator + 0.25 < monitorFrameDuration) {
    monitorFrameRequest = window.requestAnimationFrame(runMonitorFrame);
    return;
  }
  const delta = Math.min(monitorFrameAccumulator, 100);
  monitorFrameAccumulator %= monitorFrameDuration;
  updateMonitorEffects(timestamp, delta);
  monitorFrameRequest = window.requestAnimationFrame(runMonitorFrame);
}

function startMonitorEffects() {
  if (reducedMotion || document.hidden || !crtCanvas || monitorFrameRequest) return;
  resizeCrtCanvas();
  lastMonitorFrame = null;
  monitorFrameAccumulator = 0;
  monitorFrameRequest = window.requestAnimationFrame(runMonitorFrame);
}

function stopMonitorEffects() {
  if (monitorFrameRequest) window.cancelAnimationFrame(monitorFrameRequest);
  monitorFrameRequest = 0;
  lastMonitorFrame = null;
  monitorFrameAccumulator = 0;
  if (reducedMotion && crtContext && crtWidth && crtHeight) crtContext.clearRect(0, 0, crtWidth, crtHeight);
}

window.addEventListener('resize', resizeCrtCanvas, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopMonitorEffects();
  else startMonitorEffects();
});
startMonitorEffects();

document.addEventListener('keydown', (event) => {
  if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
  if (launcher && !launcher.hidden) {
    const options = [...(launcherOptions?.querySelectorAll('[data-launch-index]') || [])];
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLauncher();
    } else if (event.key === 'Tab') {
      const focusables = [...launcher.querySelectorAll('button:not([disabled]), input:not([disabled])')];
      if (event.shiftKey && document.activeElement === focusables[0]) {
        event.preventDefault();
        focusables.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === focusables.at(-1)) {
        event.preventDefault();
        focusables[0]?.focus();
      }
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!options.length) return;
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      launcherIndex = (launcherIndex + direction + options.length) % options.length;
      renderLauncherOptions(launcherInput?.value || '');
    } else if (event.key === 'Enter' && options.length) {
      event.preventDefault();
      const selected = launcherOptions.querySelector(`[data-launch-index="${launcherIndex}"]`);
      if (selected) launchWindow(selected.dataset.launchWindow);
    }
    return;
  }
  if (intro && !intro.hidden) return;
  const target = event.target;
  if (target?.isContentEditable || target?.matches('input, textarea, select, [role="textbox"]')) return;
  const key = event.key.toLowerCase();
  if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    moveWindowFocus(event.key);
    return;
  }
  if (key === 'q') {
    event.preventDefault();
    closeWindow();
    return;
  }
  if (event.code === 'Space' || event.key === ' ') {
    event.preventDefault();
    openLauncher();
    return;
  }
  if (event.key === ',') {
    event.preventDefault();
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    return;
  }
  if (key === 'f') {
    event.preventDefault();
    desktopLayout = desktopLayout === 'focus' ? 'overview' : 'focus';
    renderDesktop();
    desktopView?.querySelector(`[data-window="${focusedWindow}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (event.shiftKey && (event.key === '+' || event.key === '_' || event.code === 'Equal' || event.code === 'Minus')) {
    event.preventDefault();
    const direction = event.key === '+' || event.code === 'Equal' ? 1 : -1;
    resizeFocusedWindowHeight(direction);
    return;
  }
  if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    resizeFocusedWindow(1);
    return;
  }
  if (event.key === '-' || event.key === '_') {
    event.preventDefault();
    resizeFocusedWindow(-1);
    return;
  }
  const spaceByKey = { '1': 'home', '2': 'profile', '3': 'contact' };
  const space = spaceByKey[event.key];
  if (!space) return;
  event.preventDefault();
  switchDesktopSpace(space);
  desktopView?.querySelector(`[data-desktop-space="${space}"]`)?.focus({ preventScroll: true });
});

const glow = document.querySelector('.pointer-glow');
const cursorOutside = document.querySelector('#cursor-outside');
const cursorInside = document.querySelector('#cursor-inside');
const cursorSupported = window.matchMedia('(pointer: fine)').matches && cursorOutside && cursorInside;

if (cursorSupported) {
  document.body.classList.add('has-custom-cursor');
  window.addEventListener('pointermove', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const isTyping = Boolean(target?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
    const inScreen = Boolean(target?.closest('.desktop-canvas'));
    monitorPointer = {
      x: event.clientX,
      y: event.clientY,
      isTyping,
      inScreen,
      hovering: Boolean(target?.closest('a, button, [role="button"], [data-project], [data-desktop-space]'))
    };
    if (!inScreen && !isTyping) {
      cursorInside.classList.remove('is-visible', 'is-hovering');
      cursorOutside.style.left = `${event.clientX}px`;
      cursorOutside.style.top = `${event.clientY}px`;
      cursorOutside.classList.add('is-visible');
      cursorOutside.classList.toggle('is-hovering', monitorPointer.hovering);
      if (!reducedMotion && glow) {
        glow.style.left = `${event.clientX}px`;
        glow.style.top = `${event.clientY}px`;
        glow.style.opacity = '1';
      }
    } else if (inScreen && !reducedMotion && glow) {
      glow.style.opacity = '0';
    }
    if (isTyping) {
      cursorOutside.classList.remove('is-visible', 'is-hovering');
      cursorInside.classList.remove('is-visible', 'is-hovering');
      if (glow) glow.style.opacity = '0';
    }
  }, { passive: true });
  document.addEventListener('pointerleave', () => {
    monitorPointer = null;
    cursorOutside.classList.remove('is-visible', 'is-hovering');
    cursorInside.classList.remove('is-visible', 'is-hovering');
    if (glow) glow.style.opacity = '0';
  });
} else if (window.matchMedia('(pointer: fine)').matches && glow && !reducedMotion) {
  window.addEventListener('pointermove', (event) => {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
    glow.style.opacity = '1';
  }, { passive: true });
  document.addEventListener('pointerleave', () => { glow.style.opacity = '0'; });
}

const interactionFx = document.querySelector('#interaction-fx');
document.addEventListener('pointerdown', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest('a, button, [role="button"], [data-project], [data-open-window], .desktop-window')) return;
  if (target.closest('.desktop-canvas')) {
    monitorCursorClickAt = performance.now();
    return;
  }
  cursorOutside?.classList.add('is-clicking');
  window.setTimeout(() => cursorOutside?.classList.remove('is-clicking'), 320);
});

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('a, button, [role="button"], [data-project], [data-open-window], .desktop-window') : null;
  if (!target) return;
  const inScreen = Boolean(target.closest('.desktop-canvas'));
  if (inScreen) {
    if (!reducedMotion) monitorFlashes.set(target, { startedAt: performance.now(), duration: 300 });
  } else {
    target.classList.remove('is-activated');
    requestAnimationFrame(() => target.classList.add('is-activated'));
    window.setTimeout(() => target.classList.remove('is-activated'), 330);
  }
  if (!interactionFx || reducedMotion) return;

  const bounds = target.getBoundingClientRect();
  const x = event.detail === 0 && !event.clientX ? bounds.left + bounds.width / 2 : event.clientX;
  const y = event.detail === 0 && !event.clientY ? bounds.top + bounds.height / 2 : event.clientY;
  for (let index = 0; index < 9; index += 1) {
    const bit = document.createElement('span');
    const angle = (Math.PI * 2 * index / 9) + (Math.random() - 0.5) * 0.38;
    const distance = 28 + Math.random() * 44;
    const spin = Math.round((Math.random() - 0.5) * 90);
    bit.className = `byte-particle${target.closest('.desktop-canvas') ? ' is-screen' : ''}`;
    bit.textContent = Math.random() > 0.5 ? '01' : '10';
    bit.style.left = `${x}px`;
    bit.style.top = `${y}px`;
    bit.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    bit.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    bit.style.setProperty('--spin', `${spin}deg`);
    bit.style.setProperty('--delay', `${index * 12}ms`);
    if (inScreen) {
      const particle = {
        node: bit,
        x,
        y,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        spin,
        delay: index * 12,
        duration: 430,
        startedAt: performance.now()
      };
      bit.style.animation = 'none';
      bit.style.opacity = '0';
      monitorParticles.add(particle);
    } else {
      bit.addEventListener('animationend', () => bit.remove(), { once: true });
    }
    interactionFx.append(bit);
  }
});

const rotatingText = document.querySelector('.rotating-text');
if (rotatingText && !reducedMotion) {
  const phrases = ['build software', 'solve practical problems', 'keep learning'];
  let phraseIndex = 0;
  rotatingText.textContent = '';
  const typeNext = (delay = 220) => monitorTimeout(() => {
    const phrase = phrases[phraseIndex];
    monitorTypeText(rotatingText, phrase, 72, () => {
      monitorTimeout(() => monitorTypeText(rotatingText, phrase, 38, () => {
        rotatingText.textContent = '';
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typeNext(280);
      }, true), 1250);
    });
  }, delay);
  typeNext();
}

async function loadGitHubActivity() {
  const chart = document.querySelector('#github-chart');
  const note = document.querySelector('#activity-note');
  const line = chart?.querySelector('.activity-line');
  if (!chart || !note || !line) return;

  try {
    const response = await fetch('https://github-contributions-api.jogruber.de/v4/Hyde12?y=last', {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('GitHub activity is unavailable');
    const calendar = await response.json();
    if (!Array.isArray(calendar.contributions)) throw new Error('Contribution calendar is unavailable');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return date;
    });
    const keyFor = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const counts = new Map(calendar.contributions.map(({ date, count }) => [date, Number(count) || 0]));
    const values = days.map((date) => counts.get(keyFor(date)) || 0);
    // Give the graph a readable 0..N scale, even during a quiet week.
    const max = Math.max(2, Math.ceil(Math.max(...values) / 2) * 2);
    const yLabels = chart.querySelectorAll('.chart-y-labels text');
    [max, max / 2, 0].forEach((value, index) => {
      if (yLabels[index]) yLabels[index].textContent = String(value);
    });
    const points = values.map((value, index) => ({
      x: 78 + (582 / 6) * index,
      y: 140 - (value / max) * 116
    }));
    line.setAttribute('points', points.map(({ x, y }) => `${x},${y}`).join(' '));
    chart.querySelectorAll('.activity-points circle').forEach((circle, index) => {
      circle.setAttribute('cx', points[index].x);
      circle.setAttribute('cy', points[index].y);
      circle.setAttribute('aria-label', `${values[index]} public contributions`);
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${days[index].toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}: ${values[index]} contributions`;
      circle.replaceChildren(title);
    });
    chart.querySelectorAll('.chart-labels text').forEach((label, index) => {
      label.setAttribute('x', points[index].x);
      label.textContent = days[index].toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
    });
    chart.dataset.state = 'ready';
    chart.setAttribute('aria-label', `GitHub public contributions over the past 7 days: ${values.join(', ')}`);
    const total = values.reduce((sum, value) => sum + value, 0);
    note.textContent = `${total} public contributions · last 7 days`;
  } catch {
    chart.dataset.state = 'unavailable';
    chart.setAttribute('aria-label', 'GitHub contribution activity is currently unavailable');
    note.textContent = 'Public contribution data is currently unavailable.';
  }
}

loadGitHubActivity();

// Pointer positions are sampled by the monitor frame controller.
const tiltTargets = [...document.querySelectorAll('.hero-terminal, .github-preview')];
if (window.matchMedia('(pointer: fine)').matches && !reducedMotion) {
  tiltTargets.forEach((target, index) => {
    const amount = index === 0 ? 2.6 : 1.2;
    target.addEventListener('pointermove', (event) => {
      const bounds = target.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      target.dataset.pointerTilt = '1';
      target.dataset.tiltX = String(y * -amount);
      target.dataset.tiltY = String(x * amount);
      target.dataset.spotX = `${(x + 0.5) * 100}%`;
      target.dataset.spotY = `${(y + 0.5) * 100}%`;
    }, { passive: true });
    target.addEventListener('pointerleave', () => {
      target.dataset.pointerTilt = '1';
      target.dataset.tiltX = '0';
      target.dataset.tiltY = '0';
    });
  });
}

const projectOptions = [...document.querySelectorAll('.project-option')];

// A small, local portfolio shell. Commands are simulated and never execute on the device.
const terminalForm = document.querySelector('#terminal-form');
const terminalInput = document.querySelector('#terminal-input');
const terminalOutput = document.querySelector('#terminal-output');
const terminalCwd = document.querySelector('#terminal-cwd');
const terminalHistory = [];
let historyPosition = 0;
let workingDirectory = [];

function projectForFolder(folder) {
  return projectOptions.find((option) => option.dataset.folder === folder);
}

function terminalPath() {
  return workingDirectory.length ? `~/${workingDirectory.join('/')}` : '~';
}

function printTerminal(command, output = '') {
  const entry = document.createElement('div');
  entry.className = 'terminal-entry';
  const prompt = document.createElement('p');
  prompt.innerHTML = '<span class="prompt">hyde@portfolio</span><span class="punct">:</span><span class="path"></span><span class="punct">$</span> ';
  prompt.querySelector('.path').textContent = terminalPath();
  prompt.append(document.createTextNode(command));
  entry.append(prompt);
  if (output) {
    const result = document.createElement('pre');
    result.textContent = output;
    entry.append(result);
  }
  terminalOutput.append(entry);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function projectReadme(option) {
  return [`# ${option.dataset.project}`, '', option.dataset.summary, '', '## Highlights', ...option.dataset.highlights.split('|').map((line) => `  • ${line}`), '', `## Built with\n${option.dataset.stack}`, '', `## Run\n${option.dataset.command}`].join('\n');
}

function portfolioTree() {
  const projects = projectOptions.map((option) => option.dataset.folder);
  const rootEntries = ['about.txt', 'contact.txt', 'README.md', 'projects/'];
  const lines = ['.'];
  rootEntries.forEach((entry, index) => {
    const last = index === rootEntries.length - 1;
    lines.push(`${last ? '└──' : '├──'} ${entry}`);
    if (entry !== 'projects/') return;
    projects.forEach((folder, projectIndex) => {
      const lastProject = projectIndex === projects.length - 1;
      const branch = lastProject ? '└──' : '├──';
      lines.push(`    ${branch} ${folder}/`);
      lines.push(`    ${lastProject ? '    ' : '│   '}└── README.md`);
    });
  });
  return lines.join('\n');
}

function runTerminalCommand(rawCommand, printPrompt = true) {
  const command = rawCommand.trim();
  if (!command) return;
  if (printPrompt) printTerminal(command);
  const [name = '', ...args] = command.split(/\s+/);
  const argument = args.join(' ');
  const normalized = name.toLowerCase();
  let output = '';

  if (normalized === 'clear') {
    terminalOutput.replaceChildren();
  } else if (normalized === 'help') {
    output = 'help                 show available commands\ntree                 show portfolio folders and projects\nls [directory]       list files and directories\npwd                  print current directory\ncd <directory>       change directory\ncat <file>           read a project or portfolio file\nwhoami               about Hyde\nclear                clear the screen';
  } else if (normalized === 'tree') {
    output = portfolioTree();
  } else if (normalized === 'whoami') {
    output = 'Zil Hyde Buenaventura\nStudent developer · Philippines\nI build across different areas, from Rust tools to collaborative projects like Lakad.';
  } else if ((normalized === 'cargo' && args[0] === 'run') || (normalized === 'npm' && args[0] === 'run') || (normalized === 'python' && args[0] === 'app.py')) {
    const option = projectForFolder(workingDirectory.at(-1));
    if (!option) output = 'Choose a project directory first: cd projects/<directory>';
    else if (option.dataset.command === command || (normalized === 'npm' && option.dataset.folder === 'lakad')) output = `[portfolio demo] ${option.dataset.project}\n${option.dataset.summary}\n\nNo code is executed here; this terminal is a portfolio walkthrough.`;
    else output = `That run command is not listed for ${option.dataset.folder}/. Try: ${option.dataset.command}`;
  } else if (normalized === 'xdg-open') {
    output = `External links are shown in the ${projectForFolder(workingDirectory.at(-1))?.dataset.project || 'project'} preview. Nothing was opened.`;
  } else if (normalized === 'pwd') {
    output = `/home/hyde${workingDirectory.length ? `/${workingDirectory.join('/')}` : ''}`;
  } else if (normalized === 'ls') {
    const destination = argument.replace(/^~\/?/, '').replace(/\/$/, '');
    if (!destination && workingDirectory.length === 0) output = 'about.txt  contact.txt  projects/  README.md';
    else if (destination === 'projects' || (workingDirectory.length === 0 && destination === 'projects/')) output = projectOptions.map((option) => `${option.dataset.folder}/`).join('  ');
    else if (workingDirectory[0] === 'projects' && workingDirectory.length === 1 && !destination) output = projectOptions.map((option) => `${option.dataset.folder}/`).join('  ');
    else if (workingDirectory[0] === 'projects' && workingDirectory.length === 2 && !destination) output = 'README.md  src/  Cargo.toml';
    else if (destination === 'desktop' && workingDirectory.at(-1) === 'chip8_emulator_rust') output = 'chip8_desktop/  roms/';
    else output = `ls: cannot access '${argument}': no such directory`;
  } else if (normalized === 'cd') {
    const target = argument.replace(/^~\/?/, '').replace(/\/$/, '');
    if (!target || target === '.') workingDirectory = [];
    else if (target === '..') workingDirectory = workingDirectory.slice(0, -1);
    else if (target === 'projects' && workingDirectory.length === 0) workingDirectory = ['projects'];
    else {
      const folder = target.startsWith('projects/') ? target.split('/')[1] : target;
      const inProjects = workingDirectory.length === 1 && workingDirectory[0] === 'projects';
      if ((inProjects || workingDirectory.length === 0) && projectForFolder(folder)) workingDirectory = ['projects', folder];
      else output = `cd: no such directory: ${argument}`;
    }
    terminalCwd.textContent = terminalPath();
    if (!output) output = `now in ${terminalPath()}`;
  } else if (normalized === 'cat') {
    const filename = argument.replace(/^\.\//, '').replace(/^~\//, '');
    let folder = workingDirectory.at(-1);
    if (filename.startsWith('projects/')) folder = filename.split('/')[1];
    const option = projectForFolder(folder);
    if (option && (filename.endsWith('README.md') || filename === 'README.md')) output = projectReadme(option);
    else if (!workingDirectory.length && filename === 'README.md') output = 'Welcome to Hyde’s portfolio.\n\nBrowse projects with ls projects, then cd into one to read its README.md.\nTry: cd projects/lakad && cat README.md';
    else if (!workingDirectory.length && filename === 'about.txt') output = 'Zil Hyde Buenaventura\nStudent developer in the Philippines.\nMy projects range from Rust tools to collaborative work like Lakad.';
    else if (!workingDirectory.length && filename === 'contact.txt') output = 'Email: zillyhyde.games@gmail.com\nGitHub: github.com/Hyde12';
    else output = `cat: ${argument}: no such file`;
  } else {
    output = `${name}: command not found. Type 'help' to see available commands.`;
  }
  if (output) {
    const lastEntry = terminalOutput.lastElementChild;
    const result = document.createElement('pre');
    result.textContent = output;
    lastEntry?.append(result);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }
}

terminalForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const command = terminalInput.value.trim();
  if (!command) return;
  terminalHistory.push(command);
  historyPosition = terminalHistory.length;
  command.split(/\s*&&\s*/).forEach((part) => runTerminalCommand(part));
  terminalInput.value = '';
});

terminalInput?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    historyPosition = Math.max(0, historyPosition - 1);
    terminalInput.value = terminalHistory[historyPosition] || '';
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    historyPosition = Math.min(terminalHistory.length, historyPosition + 1);
    terminalInput.value = terminalHistory[historyPosition] || '';
  }
});

document.querySelectorAll('[data-terminal-command]').forEach((button) => {
  button.addEventListener('click', () => {
    const command = button.dataset.terminalCommand;
    command.split(/\s*&&\s*/).forEach((part) => runTerminalCommand(part));
    terminalInput?.focus();
  });
});

const consolePath = document.querySelector('.console-path');
const consoleCommand = document.querySelector('.typed-command');
const consoleReadme = document.querySelector('.console-readme');
const consoleKicker = document.querySelector('.readme-kicker span');
const consoleTitle = document.querySelector('.readme-title');
const consoleSummary = document.querySelector('.readme-summary');
const consoleHighlights = document.querySelector('.readme-highlights');
const consoleStack = document.querySelector('.readme-stack');
const consoleLink = document.querySelector('.readme-link');
const consoleStatus = document.querySelector('.console-status');
let cancelProjectTyping = null;
let cancelReadmeReveal = null;

function selectProject(option) {
  projectOptions.forEach((item) => {
    const selected = item === option;
    item.classList.toggle('selected', selected);
    item.setAttribute('aria-pressed', String(selected));
  });

  const { project, folder, command, kicker, summary, highlights, stack, link } = option.dataset;
  const commandText = `cd ${folder} && ${command}`;
  consolePath.textContent = `zsh — zil@portfolio: ~/projects/${folder}`;
  consoleKicker.textContent = kicker;
  consoleTitle.textContent = project;
  consoleSummary.textContent = summary;
  consoleHighlights.replaceChildren(...highlights.split('|').map((text) => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
  consoleStack.textContent = stack;
  consoleLink.href = link;
  consoleReadme.classList.add('is-printing');
  consoleReadme.style.opacity = '.25';
  consoleReadme.style.transform = 'translateY(4px)';
  consoleStatus.textContent = 'RUNNING';
  consoleCommand.textContent = '';

  cancelProjectTyping?.();
  cancelReadmeReveal?.();
  if (reducedMotion) {
    consoleCommand.textContent = commandText;
    consoleReadme.classList.remove('is-printing');
    consoleReadme.style.removeProperty('opacity');
    consoleReadme.style.removeProperty('transform');
    consoleStatus.textContent = 'README READY';
    return;
  }

  cancelProjectTyping = monitorTypeText(consoleCommand, commandText, 24, () => {
    consoleStatus.textContent = 'README READY';
    cancelReadmeReveal = monitorTween(180, (progress) => {
      consoleReadme.style.opacity = String(0.25 + 0.75 * progress);
      consoleReadme.style.transform = `translateY(${4 * (1 - progress)}px)`;
    }, () => {
      consoleReadme.classList.remove('is-printing');
      consoleReadme.style.removeProperty('opacity');
      consoleReadme.style.removeProperty('transform');
      cancelReadmeReveal = null;
    });
  });
}

projectOptions.forEach((option) => {
  option.addEventListener('click', () => selectProject(option));
  option.addEventListener('pointermove', (event) => {
    const bounds = option.getBoundingClientRect();
    option.dataset.spotX = `${event.clientX - bounds.left}px`;
    option.dataset.spotY = `${event.clientY - bounds.top}px`;
  });
});
if (projectOptions[0]) selectProject(projectOptions[0]);

const revealItems = document.querySelectorAll('.mode-view:not([hidden]) .reveal');
if ('IntersectionObserver' in window && !reducedMotion) {
  revealObserver = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const item = entry.target;
      item.classList.add('is-visible');
      if (item.closest('.desktop-canvas')) {
        item.style.opacity = '0';
        item.style.transform = 'translateY(12px)';
        monitorTween(550, (progress) => {
          const eased = 1 - (1 - progress) ** 3;
          item.style.opacity = String(eased);
          item.style.transform = `translateY(${12 * (1 - eased)}px)`;
        }, () => {
          item.style.removeProperty('opacity');
          item.style.removeProperty('transform');
        });
      }
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.28, rootMargin: '0px 0px -110px 0px' });
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}
