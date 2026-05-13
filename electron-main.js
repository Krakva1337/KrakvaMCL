const { app, BrowserWindow, Menu, ipcMain, dialog, shell, nativeImage } = require('electron');
const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const extractZip = require('extract-zip');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Cache system for frequently accessed data
const cache = {
    builds: { data: null, timestamp: 0, ttl: 5000 },
    modsFilters: { data: null, timestamp: 0, ttl: 60000 },
    buildOptions: { data: null, timestamp: 0, ttl: 30000 },
    modsSearch: new Map(),
    installedMods: new Map()
};

function getFromCache(key) {
    if (!cache[key]) return null;
    const now = Date.now();
    if (now - cache[key].timestamp > cache[key].ttl) {
        cache[key].data = null;
        cache[key].timestamp = 0;
        return null;
    }
    return cache[key].data;
}

function setInCache(key, data, ttl) {
    if (!cache[key]) {
        cache[key] = { data: null, timestamp: 0, ttl: ttl || 5000 };
    }
    if (ttl) cache[key].ttl = ttl;
    cache[key].data = data;
    cache[key].timestamp = Date.now();
}

const MODRINTH_API_BASE = 'https://api.modrinth.com/v2';
const MODRINTH_USER_AGENT = 'KrakvaMCL/2.0 (desktop launcher)';
const FABRIC_META_BASE = 'https://meta.fabricmc.net/v2';
const FORGE_MAVEN_BASE = 'https://maven.minecraftforge.net';
const FORGE_PROMOTIONS_URL = `${FORGE_MAVEN_BASE}/net/minecraftforge/forge/promotions_slim.json`;
const FORGE_MAVEN_METADATA_URL = `${FORGE_MAVEN_BASE}/net/minecraftforge/forge/maven-metadata.xml`;
const DEFAULT_GAME_VERSION = '1.21.11';
const DEFAULT_LOADER = 'vanilla';
const DEFAULT_BUILD_ID = 'Standart';
const DEFAULT_LIBRARY_MAVEN_BASE = 'https://libraries.minecraft.net';
const ALLOWED_BUILD_LOADERS = ['vanilla', 'forge', 'fabric', 'neoforge'];
const MOJANG_VERSION_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const BUILD_CONFIG_IMPORT_FILES = ['options.txt', 'servers.dat'];
const BUILD_CONFIG_IMPORT_DIRS = ['config', 'resourcepacks', 'shaderpacks', 'optionsof', 'screenshots'];
const GITHUB_OWNER = 'Krakva1337';
const GITHUB_REPO = 'KrakvaMCL';
const GITHUB_BRANCH = 'main';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
const GITHUB_PACKAGE_CONTENTS_URL = `${GITHUB_API_BASE}/contents/package.json?ref=${GITHUB_BRANCH}`;
const GITHUB_ZIPBALL_URL = `${GITHUB_API_BASE}/zipball/${GITHUB_BRANCH}`;
const CONTENT_TYPE_MAP = {
    mods: { projectType: 'mod', subdir: 'mods', useLoader: true, browseInstallOnlyFiles: true },
    resourcepacks: { projectType: 'resourcepack', subdir: 'resourcepacks', useLoader: false },
    shaderpacks: { projectType: 'shader', subdir: 'shaderpacks', useLoader: false },
    datapacks: { projectType: 'datapack', subdir: 'datapacks', useLoader: false },
    modpacks: { projectType: 'modpack', subdir: 'modpacks', useLoader: false }
};
const INSTALLABLE_CONTENT_TYPES = Object.keys(CONTENT_TYPE_MAP);

let mainWindow = null;
let activeGameProcess = null;
let latestCrashReportPath = '';
let discordRpc = null;
let discordRpcClient = null;
let discordRpcReady = false;
let discordRpcLoginStarted = false;
let discordPresenceState = {
    activeView: 'play',
    gameRunning: false,
    gameVersion: '',
    buildName: '',
    gameMode: '',
    gameStartTimestamp: null,
    launchTitle: '',
    launchDetail: ''
};
const WINDOW_CLOSE_ANIMATION_MS = 260;
const WINDOW_OPEN_ANIMATION_MS = 320;

const legacySettingsPath = path.join(__dirname, 'settings.json');
const legacyBuildsRoot = path.join(__dirname, 'builds');
const launcherDataRoot = getLauncherDataRoot();
const settingsPath = path.join(launcherDataRoot, 'settings.json');
const buildsRoot = path.join(launcherDataRoot, 'builds');
const versionsRoot = path.join(launcherDataRoot, 'versions');
const librariesRoot = path.join(launcherDataRoot, 'libraries');
const assetsRoot = path.join(launcherDataRoot, 'assets');
const javaRuntimesRoot = path.join(launcherDataRoot, 'java-runtimes');
const logConfigsRoot = path.join(launcherDataRoot, 'log-configs');
const reportsRoot = path.join(launcherDataRoot, 'crash-reports');
const javaCandidatesCachePath = path.join(launcherDataRoot, 'java-candidates-cache.json');
const appCachePath = path.join(launcherDataRoot, 'app-cache.json');
const bundledKrakvaAgentPath = path.join(__dirname, 'assets', 'KrakvaAgent-runtime.jar');
const bundledAuthlibInjectorPath = path.join(__dirname, 'assets', 'authlib-injector-1.2.7.jar');
const DISCORD_RPC_GITHUB_URL = 'https://github.com/Krakva1337/KrakvaMCL';
const DISCORD_RPC_CLIENT_ID = '1504040954552914081';
const DISCORD_RPC_VERSION_LABEL = '3.0 - Alpha';
// URL auth-сервера для authlib-injector (ALT API / Yggdrasil-совместимый).
// Замени на адрес своего сервера (Ely.by: https://authserver.ely.by/api/authlib-injector).
const AUTHLIB_INJECTOR_AUTH_SERVER = 'https://authserver.ely.by/api/authlib-injector';

function getLauncherDataRoot() {
    const home = os.homedir();

    if (process.platform === 'win32') {
        const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        return path.join(appData, '.KrakvaMCL');
    }

    return path.join(home, 'Documents', '.KrakvaMCL');
}

function ensureLauncherDataRoot() {
    fs.mkdirSync(launcherDataRoot, { recursive: true });
    fs.mkdirSync(buildsRoot, { recursive: true });
    fs.mkdirSync(versionsRoot, { recursive: true });
    fs.mkdirSync(librariesRoot, { recursive: true });
    fs.mkdirSync(assetsRoot, { recursive: true });
    fs.mkdirSync(javaRuntimesRoot, { recursive: true });
    fs.mkdirSync(logConfigsRoot, { recursive: true });
    fs.mkdirSync(reportsRoot, { recursive: true });
}

function readJavaCandidatesCache() {
    if (!fs.existsSync(javaCandidatesCachePath)) {
        return null;
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(javaCandidatesCachePath, 'utf-8'));
        if (!Array.isArray(parsed?.javaOptions)) {
            return null;
        }

        const freshForMs = process.platform === 'win32' ? 1000 * 60 * 60 * 12 : 1000 * 60 * 30;
        const timestamp = Number(parsed.timestamp || 0);
        const isFresh = Date.now() - timestamp < freshForMs;
        const javaOptions = parsed.javaOptions.filter((option) => {
            return option?.value === 'auto' || (option?.value && fs.existsSync(option.value));
        });

        if (!javaOptions.length) {
            return null;
        }

        return {
            isFresh,
            javaOptions
        };
    } catch {
        return null;
    }
}

function writeJavaCandidatesCache(javaOptions = []) {
    try {
        ensureLauncherDataRoot();
        fs.writeFileSync(javaCandidatesCachePath, JSON.stringify({
            timestamp: Date.now(),
            javaOptions
        }, null, 2));
    } catch {
        // Ignore cache write errors.
    }
}

function readAppCache() {
    if (!fs.existsSync(appCachePath)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(appCachePath, 'utf-8'));
    } catch {
        return null;
    }
}

function writeAppCache(value) {
    ensureLauncherDataRoot();
    fs.writeFileSync(appCachePath, JSON.stringify(value ?? null, null, 2));
    return true;
}

function ensureBundledAssetFile(sourcePath, destinationName) {
    if (!sourcePath || !destinationName || !fs.existsSync(sourcePath)) {
        return null;
    }

    const destinationPath = path.join(assetsRoot, destinationName);
    const sourceStat = fs.statSync(sourcePath);
    const destinationStat = fs.existsSync(destinationPath) ? fs.statSync(destinationPath) : null;

    if (!destinationStat || destinationStat.size !== sourceStat.size) {
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.copyFileSync(sourcePath, destinationPath);
    }

    return destinationPath;
}

function migrateLegacyData() {
    ensureLauncherDataRoot();

    if (!fs.existsSync(settingsPath) && fs.existsSync(legacySettingsPath)) {
        fs.copyFileSync(legacySettingsPath, settingsPath);
    }

    const hasLegacyBuilds = fs.existsSync(legacyBuildsRoot)
        && fs.readdirSync(legacyBuildsRoot, { withFileTypes: true }).some((entry) => entry.isDirectory());
    const hasCurrentBuilds = fs.existsSync(buildsRoot)
        && fs.readdirSync(buildsRoot, { withFileTypes: true }).some((entry) => entry.isDirectory());

    if (hasLegacyBuilds && !hasCurrentBuilds) {
        fs.cpSync(legacyBuildsRoot, buildsRoot, { recursive: true });
    }
}

function getSystemInfo() {
    return {
        totalRamMb: Math.max(2048, Math.floor(os.totalmem() / 1024 / 1024)),
        platform: process.platform,
        dataRoot: launcherDataRoot,
        launcherVersion: getLauncherVersion()
    };
}

function getDefaultSettings() {
    const { totalRamMb } = getSystemInfo();
    const recommendedMemory = Math.min(8192, Math.max(2048, Math.floor(totalRamMb / 4 / 256) * 256));

    return {
        language: 'Русский',
        memoryMb: recommendedMemory,
        javaPath: 'auto',
        darkMenus: true,
        activeBuildId: DEFAULT_BUILD_ID,
        minimizeToTrayOnLaunch: false,
        reopenLauncherOnGameExit: true,
        githubToken: '',
        discordRpcEnabled: true,
        discordClientId: DISCORD_RPC_CLIENT_ID
    };
}

function ensureSettingsFile() {
    ensureLauncherDataRoot();
    if (!fs.existsSync(settingsPath)) {
        fs.writeFileSync(settingsPath, JSON.stringify(getDefaultSettings(), null, 2));
    }
}

function ensureBuildsRoot() {
    ensureLauncherDataRoot();
    fs.mkdirSync(buildsRoot, { recursive: true });
    return buildsRoot;
}

function buildDirNameFromName(name) {
    return String(name || 'Build')
        .replace(/[\\/:*?"<>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'Build';
}

function getManagedJavaRuntimeId(majorVersion, targetArch = process.arch) {
    return `temurin-${Number(majorVersion) || 0}-${process.platform}-${normalizeJavaArchitecture(targetArch) || targetArch || process.arch}`;
}

function getManagedJavaRuntimeDir(majorVersion, targetArch = process.arch) {
    return path.join(javaRuntimesRoot, getManagedJavaRuntimeId(majorVersion, targetArch));
}

function getManagedJavaManifestPath(majorVersion, targetArch = process.arch) {
    return path.join(getManagedJavaRuntimeDir(majorVersion, targetArch), 'runtime.json');
}

function getBuildDir(buildId) {
    return path.join(buildsRoot, buildId);
}

function getBuildMetaPath(buildId) {
    return path.join(getBuildDir(buildId), 'build.json');
}

function getBuildModsPath(buildId) {
    return path.join(getBuildDir(buildId), 'mods');
}

function getBuildContentPath(buildId, contentType = 'mods') {
    const typeInfo = CONTENT_TYPE_MAP[contentType] || CONTENT_TYPE_MAP.mods;
    return path.join(getBuildDir(buildId), typeInfo.subdir);
}

function getBuildLibrariesPath(buildId) {
    return path.join(getBuildDir(buildId), 'libraries');
}

function getBuildModsMetaPath(buildId) {
    return path.join(getBuildDir(buildId), 'mods-meta.json');
}

function getBuildVersionsDir(buildId) {
    return path.join(getBuildDir(buildId), 'versions');
}

function getBuildReportsDir(buildId) {
    return path.join(getBuildDir(buildId), 'reports');
}

function getBuildVersionDir(buildId, versionId) {
    return path.join(getBuildVersionsDir(buildId), versionId);
}

function getBuildVersionJarPath(buildId, versionId) {
    return path.join(getBuildVersionDir(buildId, versionId), `${versionId}.jar`);
}

function getBuildVersionMetaPath(buildId, versionId) {
    return path.join(getBuildVersionDir(buildId, versionId), `${versionId}.json`);
}

function getBuildGameDir(buildId) {
    return getBuildDir(buildId);
}

function isLegacyMacWindowedBuild(build = null) {
    if (process.platform !== 'darwin') {
        return false;
    }

    const parsed = parseMinecraftReleaseVersion(build?.minecraftVersion || '');
    if (!parsed || parsed.major !== 1) {
        return false;
    }

    return parsed.minor <= 12;
}

function ensureLegacyMacWindowedOptions(build) {
    if (!isLegacyMacWindowedBuild(build)) {
        return;
    }

    const optionsPath = path.join(getBuildGameDir(build.id), 'options.txt');
    const requiredEntries = new Map([
        ['fullscreen', 'false'],
        ['pauseOnLostFocus', 'false']
    ]);

    let lines = [];
    if (fs.existsSync(optionsPath)) {
        try {
            lines = fs.readFileSync(optionsPath, 'utf-8').split(/\r?\n/).filter(Boolean);
        } catch {
            lines = [];
        }
    }

    const remainingKeys = new Set(requiredEntries.keys());
    const patchedLines = lines.map((line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
            return line;
        }

        const key = line.slice(0, separatorIndex);
        if (!requiredEntries.has(key)) {
            return line;
        }

        remainingKeys.delete(key);
        return `${key}:${requiredEntries.get(key)}`;
    });

    remainingKeys.forEach((key) => {
        patchedLines.push(`${key}:${requiredEntries.get(key)}`);
    });

    fs.mkdirSync(path.dirname(optionsPath), { recursive: true });
    fs.writeFileSync(optionsPath, `${patchedLines.join('\n')}\n`, 'utf-8');
}

function getAssetsIndexesDir() {
    return path.join(assetsRoot, 'indexes');
}

function getAssetsObjectsDir() {
    return path.join(assetsRoot, 'objects');
}

function getAssetIndexPath(assetIndexId) {
    return path.join(getAssetsIndexesDir(), `${assetIndexId}.json`);
}

function getLogConfigPath(fileId = '') {
    return path.join(logConfigsRoot, fileId);
}

function getVersionNativesDir(buildId, versionId) {
    return path.join(getBuildVersionDir(buildId, versionId), 'natives');
}

function defaultBuildMeta() {
    return {
        id: DEFAULT_BUILD_ID,
        name: 'Standart',
        minecraftVersion: DEFAULT_GAME_VERSION,
        loader: DEFAULT_LOADER,
        isDefault: true,
        legacy: true
    };
}

function normalizeModKey(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\.jar(?:\.disabled)?$/i, '')
        .replace(/[^a-z0-9]+/g, '');
}

function inferModTitle(filename) {
    return String(filename || '')
        .replace(/\.jar(?:\.disabled)?$/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function loadBuildModsMeta(buildId) {
    const metaPath = getBuildModsMetaPath(buildId);

    if (!fs.existsSync(metaPath)) {
        return {};
    }

    try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch {
        return {};
    }
}

function saveBuildModsMeta(buildId, payload) {
    fs.writeFileSync(getBuildModsMetaPath(buildId), JSON.stringify(payload || {}, null, 2));
}

function setBuildModMeta(buildId, filename, payload) {
    const metadata = loadBuildModsMeta(buildId);
    metadata[filename] = {
        ...(metadata[filename] || {}),
        ...(payload || {})
    };
    saveBuildModsMeta(buildId, metadata);
}

function getDirectorySize(targetPath) {
    if (!fs.existsSync(targetPath)) {
        return 0;
    }

    const stat = fs.statSync(targetPath);
    if (stat.isFile()) {
        return stat.size;
    }

    return fs.readdirSync(targetPath, { withFileTypes: true }).reduce((total, entry) => {
        return total + getDirectorySize(path.join(targetPath, entry.name));
    }, 0);
}

function copyRecursive(source, destination) {
    const stat = fs.statSync(source);
    if (stat.isDirectory()) {
        fs.mkdirSync(destination, { recursive: true });
        fs.readdirSync(source, { withFileTypes: true }).forEach((entry) => {
            copyRecursive(path.join(source, entry.name), path.join(destination, entry.name));
        });
        return;
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
}

function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) {
        return `${value} B`;
    }

    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`;
    }

    if (value < 1024 * 1024 * 1024) {
        return `${(value / 1024 / 1024).toFixed(1)} MB`;
    }

    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDiscordViewLabel(view = '') {
    const labels = {
        play: 'Играть',
        mods: 'Modrinth',
        'mod-manager': 'Менеджер',
        builds: 'Сборки',
        news: 'Новости',
        settings: 'Настройки'
    };

    return labels[String(view || '').toLowerCase()] || 'Лаунчер';
}

function getDiscordRpcClientId() {
    const envClientId = String(process.env.KRAKVAMCL_DISCORD_CLIENT_ID || '').trim();
    if (envClientId) {
        return envClientId;
    }

    try {
        if (fs.existsSync(settingsPath)) {
            const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            return String(parsed?.discordClientId || DISCORD_RPC_CLIENT_ID).trim();
        }
    } catch {
        return DISCORD_RPC_CLIENT_ID;
    }

    return DISCORD_RPC_CLIENT_ID;
}

function buildDiscordActivity() {
    const details = `Версия лаунчера ${getLauncherVersion() || DISCORD_RPC_VERSION_LABEL}`;
    const buttons = [{ label: 'GitHub', url: DISCORD_RPC_GITHUB_URL }];
    const state = resolveDiscordUserActivity();
    const largeText = 'KrakvaMCL';

    const activity = {
        details,
        state,
        largeImageText: largeText,
        buttons,
        instance: false
    };

    if (discordPresenceState.gameRunning && discordPresenceState.gameStartTimestamp) {
        activity.startTimestamp = new Date(discordPresenceState.gameStartTimestamp);
    }

    return activity;
}

function detectDiscordGameMode(launchTitle = '', launchDetail = '') {
    const combined = `${String(launchTitle || '').toLowerCase()} ${String(launchDetail || '').toLowerCase()}`;
    if (/(multiplayer|server|serverip|connecting to|join|realm|realms)/i.test(combined)) {
        return 'multiplayer';
    }

    if (/(singleplayer|integrated server|local game|одиноч|single player)/i.test(combined)) {
        return 'singleplayer';
    }

    return '';
}

function resolveDiscordUserActivity() {
    if (!discordPresenceState.gameRunning) {
        return 'В лаунчере';
    }

    const gameMode = discordPresenceState.gameMode
        || detectDiscordGameMode(discordPresenceState.launchTitle, discordPresenceState.launchDetail);

    if (gameMode === 'multiplayer') {
        return 'Играет | Мультиплеер';
    }

    return 'Играет | Одиночная игра';
}

function applyDiscordPresence() {
    if (!discordRpcReady || !discordRpcClient) {
        return;
    }

    try {
        discordRpcClient.setActivity(buildDiscordActivity());
    } catch {
        // Ignore transient RPC failures.
    }
}

function ensureDiscordRpc() {
    if (discordRpcLoginStarted || process.platform !== 'win32' && process.platform !== 'darwin') {
        return;
    }

    const settings = loadSettings();
    if (settings.discordRpcEnabled === false) {
        return;
    }

    const clientId = getDiscordRpcClientId();
    if (!clientId) {
        return;
    }

    try {
        discordRpc = require('discord-rpc');
    } catch {
        return;
    }

    discordRpcLoginStarted = true;
    discordRpc.register(clientId);
    discordRpcClient = new discordRpc.Client({ transport: 'ipc' });

    discordRpcClient.on('ready', () => {
        discordRpcReady = true;
        applyDiscordPresence();
    });

    discordRpcClient.on('disconnected', () => {
        discordRpcReady = false;
    });

    discordRpcClient.login({ clientId }).catch(() => {
        discordRpcLoginStarted = false;
        discordRpcReady = false;
    });
}

function updateDiscordPresence(patch = {}) {
    const nextState = {
        ...discordPresenceState,
        ...(patch || {})
    };
    const detectedGameMode = patch?.gameMode
        || detectDiscordGameMode(nextState.launchTitle, nextState.launchDetail)
        || nextState.gameMode;

    if (nextState.gameRunning && !discordPresenceState.gameRunning) {
        nextState.gameStartTimestamp = Date.now();
    } else if (!nextState.gameRunning) {
        nextState.gameStartTimestamp = null;
        nextState.gameMode = '';
    } else {
        nextState.gameMode = detectedGameMode || 'singleplayer';
    }

    discordPresenceState = nextState;
    ensureDiscordRpc();
    applyDiscordPresence();
}

function guessCrashReason(logText = '') {
    const content = String(logText || '').toLowerCase();

    if (content.includes('could not reserve enough space')) {
        return 'Похоже, не хватает памяти Java для запуска.';
    }

    if (content.includes('unable to access jarfile')) {
        return 'Не найден jar-файл игры.';
    }

    if (content.includes('could not find or load main class net.minecraft.client.main')
        || content.includes('classnotfoundexception: net.minecraft.client.main')) {
        return 'Клиент запущен без нужного classpath. Для современной Minecraft нужен полный runtime, а не только один jar.';
    }

    if (content.includes('unsupportedclassversionerror')) {
        return 'Версия Java слишком старая или несовместимая.';
    }

    if (content.includes('address already in use')) {
        return 'Похоже, один из сетевых портов уже занят.';
    }

    if (content.includes('exception')) {
        return 'Игра завершилась с исключением. Проверьте текст отчёта.';
    }

    return 'Игра завершилась с ошибкой. Подробности сохранены в отчёте.';
}

function createCrashReport({ build, command, exitCode, stdout, stderr }) {
    fs.mkdirSync(reportsRoot, { recursive: true });
    const timestamp = new Date().toISOString().replaceAll(':', '-');
    const filePath = path.join(reportsRoot, `crash-${timestamp}.txt`);
    const mergedLog = [stdout, stderr].filter(Boolean).join('\n\n');
    const reason = guessCrashReason(mergedLog);
    const lines = [
        `KrakvaMCL Crash Report`,
        ``,
        `Time: ${new Date().toISOString()}`,
        `Build: ${build?.name || build?.id || 'Unknown'}`,
        `Minecraft Version: ${build?.minecraftVersion || 'Unknown'}`,
        `Loader: ${build?.loader || 'Unknown'}`,
        `Exit Code: ${exitCode}`,
        `Approx Reason: ${reason}`,
        `Command: ${Array.isArray(command) ? command.join(' ') : ''}`,
        ``,
        `STDOUT:`,
        stdout || '(empty)',
        ``,
        `STDERR:`,
        stderr || '(empty)'
    ];

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    latestCrashReportPath = filePath;
    return { filePath, reason };
}

function emitGameStatus(payload) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('game:status', {
        timestamp: Date.now(),
        ...payload
    });
}

function emitJavaOptionsUpdate() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    const javaOptions = [{ value: 'auto', label: 'AutoJava' }, ...getJavaCandidates()];
    writeJavaCandidatesCache(javaOptions);
    mainWindow.webContents.send('system:java-options-updated', { javaOptions });
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function emitLauncherTransition(type, durationMs) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('launcher:transition', {
        type,
        durationMs
    });
}

async function hideLauncherWindowAnimated() {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) {
        return;
    }

    emitLauncherTransition('closing', WINDOW_CLOSE_ANIMATION_MS);
    await wait(WINDOW_CLOSE_ANIMATION_MS);

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
    }
}

async function showLauncherWindowAnimated() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    if (!mainWindow.isVisible()) {
        mainWindow.show();
    }

    emitLauncherTransition('opening', WINDOW_OPEN_ANIMATION_MS);
    await wait(32);

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
    }
}

async function streamDownloadFile(url, destination, onProgress, requestOptions = {}) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });

    const response = await fetch(url, requestOptions);
    if (!response.ok) {
        throw new Error(`Не удалось скачать файл: HTTP ${response.status}`);
    }

    const totalBytes = Number(response.headers.get('content-length') || 0);
    const fileStream = fs.createWriteStream(destination);
    const reader = response.body?.getReader?.();

    if (!reader) {
        const arrayBuffer = await response.arrayBuffer();
        await fs.promises.writeFile(destination, Buffer.from(arrayBuffer));
        onProgress?.({
            downloadedBytes: Buffer.byteLength(Buffer.from(arrayBuffer)),
            totalBytes,
            speedBytes: 0
        });
        return destination;
    }

    let downloadedBytes = 0;
    let lastBytes = 0;
    let lastTime = Date.now();

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        const chunk = Buffer.from(value);
        fileStream.write(chunk);
        downloadedBytes += chunk.length;

        const now = Date.now();
        const elapsed = Math.max(1, now - lastTime);
        const delta = downloadedBytes - lastBytes;
        const speedBytes = Math.round((delta / elapsed) * 1000);

        if (now - lastTime >= 180) {
            onProgress?.({ downloadedBytes, totalBytes, speedBytes });
            lastBytes = downloadedBytes;
            lastTime = now;
        }
    }

    await new Promise((resolve) => fileStream.end(resolve));
    onProgress?.({ downloadedBytes, totalBytes, speedBytes: 0 });
    return destination;
}

function verifyFileChecksum(filePath, expectedChecksum = '') {
    const normalizedChecksum = String(expectedChecksum || '').trim().toLowerCase();
    if (!filePath || !normalizedChecksum || !fs.existsSync(filePath)) {
        return true;
    }

    const actualChecksum = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toLowerCase();
    return actualChecksum === normalizedChecksum;
}

function createOfflineUuid(username = 'Player') {
    const source = Buffer.from(`OfflinePlayer:${username}`, 'utf8');
    const digest = crypto.createHash('md5').update(source).digest();
    digest[6] = (digest[6] & 0x0f) | 0x30;
    digest[8] = (digest[8] & 0x3f) | 0x80;
    const hex = digest.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function getLauncherOsName() {
    if (process.platform === 'darwin') {
        return 'osx';
    }

    if (process.platform === 'win32') {
        return 'windows';
    }

    return 'linux';
}

function getLauncherArchBits() {
    return process.arch === 'ia32' ? '32' : '64';
}

function getLauncherArchName() {
    if (process.arch === 'x64') {
        return 'x86_64';
    }

    if (process.arch === 'ia32') {
        return 'x86';
    }

    if (process.arch === 'arm64') {
        return 'aarch64';
    }

    return process.arch;
}

function isRuleMatch(rule = {}, features = {}) {
    if (!rule || typeof rule !== 'object') {
        return false;
    }

    const osRule = rule.os || {};
    const featureRule = rule.features || {};
    const currentOsName = getLauncherOsName();
    const osVersion = os.release();
    const osArch = getLauncherArchName();

    if (osRule.name && osRule.name !== currentOsName) {
        return false;
    }

    if (osRule.arch && osRule.arch !== osArch && osRule.arch !== process.arch) {
        return false;
    }

    if (osRule.version) {
        const versionPattern = new RegExp(osRule.version);
        if (!versionPattern.test(osVersion)) {
            return false;
        }
    }

    for (const [key, expected] of Object.entries(featureRule)) {
        if (Boolean(features[key]) !== Boolean(expected)) {
            return false;
        }
    }

    return true;
}

function isAllowedByRules(rules = [], features = {}) {
    if (!Array.isArray(rules) || !rules.length) {
        return true;
    }

    let allowed = false;
    for (const rule of rules) {
        if (!isRuleMatch(rule, features)) {
            continue;
        }

        allowed = rule.action !== 'disallow';
    }

    return allowed;
}

function parseLegacyArguments(raw = '') {
    return String(raw || '')
        .match(/(?:[^\s"]+|"[^"]*")+/g)
        ?.map((token) => token.replace(/^"|"$/g, '')) || [];
}

function interpolateValue(template, replacements) {
    return String(template || '').replace(/\$\{([^}]+)\}/g, (_match, key) => {
        const value = replacements[key];
        return value === undefined || value === null ? '' : String(value);
    });
}

function resolveArgumentList(entries = [], replacements = {}, features = {}) {
    if (!Array.isArray(entries)) {
        return [];
    }

    return entries.flatMap((entry) => {
        if (typeof entry === 'string') {
            return interpolateValue(entry, replacements);
        }

        if (!entry || typeof entry !== 'object' || !isAllowedByRules(entry.rules, features)) {
            return [];
        }

        const values = Array.isArray(entry.value) ? entry.value : [entry.value];
        return values.map((value) => interpolateValue(value, replacements));
    });
}

function getLibraryArtifactPath(library = {}) {
    if (library?.downloads?.artifact?.path) {
        return library.downloads.artifact.path;
    }

    // Some legacy libraries ship only natives/classifiers and have no base jar artifact.
    if (library?.downloads && !library.downloads.artifact && library.downloads.classifiers) {
        return null;
    }

    const [group, artifact, version, classifier] = String(library.name || '').split(':');
    if (!group || !artifact || !version) {
        return null;
    }

    const filename = classifier ? `${artifact}-${version}-${classifier}.jar` : `${artifact}-${version}.jar`;
    return path.join(group.replaceAll('.', '/'), artifact, version, filename);
}

function getLegacyForgeUniversalDownloadUrl(library = {}, artifactPath = '') {
    const [group, artifact, version, classifier] = String(library.name || '').split(':');
    if (group !== 'net.minecraftforge' || artifact !== 'forge' || classifier || !version || !artifactPath) {
        return '';
    }

    const baseUrl = String(library?.url || '').trim().replace(/\/+$/, '');
    if (!baseUrl) {
        return '';
    }

    const universalFilename = `forge-${version}-universal.jar`;
    const artifactDir = path.posix.dirname(artifactPath.replaceAll(path.sep, '/'));
    return `${baseUrl}/${artifactDir}/${universalFilename}`;
}

function getLibraryArtifactDownload(library = {}) {
    if (library?.downloads?.artifact?.url) {
        return library.downloads.artifact;
    }

    const artifactPath = getLibraryArtifactPath(library);
    if (!artifactPath) {
        return null;
    }

    const baseUrl = String(library?.url || DEFAULT_LIBRARY_MAVEN_BASE).trim();
    if (!baseUrl) {
        return null;
    }

    return {
        path: artifactPath,
        url: getLegacyForgeUniversalDownloadUrl(library, artifactPath)
            || `${baseUrl.replace(/\/+$/, '')}/${artifactPath.replaceAll(path.sep, '/')}`,
        size: 0
    };
}

function getLibraryConflictKey(library = {}) {
    const [group, artifact, , classifier] = String(library?.name || '').split(':');
    if (!group || !artifact) {
        return '';
    }

    return classifier
        ? `${group}:${artifact}:${classifier}`
        : `${group}:${artifact}`;
}

function resolveNativeClassifier(library = {}) {
    const classifiers = library?.downloads?.classifiers || {};
    const nativeMap = library?.natives || {};
    const osName = getLauncherOsName();
    const baseClassifier = nativeMap[osName];
    if (!baseClassifier) {
        return null;
    }

    const archBits = getLauncherArchBits();
    const candidates = [
        String(baseClassifier).replaceAll('${arch}', archBits),
        `${String(baseClassifier).replaceAll('${arch}', archBits)}-arm64`,
        `${String(baseClassifier).replaceAll('${arch}', archBits)}-${archBits}`,
        `${String(baseClassifier).replaceAll('${arch}', archBits)}${archBits}`
    ];

    if (process.platform === 'darwin' && process.arch === 'arm64') {
        candidates.unshift('natives-macos-arm64');
    }

    for (const candidate of candidates) {
        if (classifiers[candidate]) {
            return candidate;
        }
    }

    const fallback = Object.keys(classifiers).find((key) => key.startsWith(String(baseClassifier).replaceAll('${arch}', archBits)));
    return fallback || null;
}

async function downloadArtifactIfNeeded(download, destination, onProgress) {
    if (!download?.url || !destination) {
        throw new Error('Некорректные параметры скачивания файла.');
    }

    if (fs.existsSync(destination)) {
        const stat = fs.statSync(destination);
        if (!download.size || stat.size === download.size) {
            return destination;
        }
    }

    const tempPath = `${destination}.download`;
    if (fs.existsSync(tempPath)) {
        fs.rmSync(tempPath, { force: true });
    }

    await streamDownloadFile(download.url, tempPath, onProgress);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (fs.existsSync(destination)) {
        fs.rmSync(destination, { force: true });
    }
    fs.renameSync(tempPath, destination);
    return destination;
}

async function ensureVersionMetadata(buildId, versionId) {
    const metaPath = getBuildVersionMetaPath(buildId, versionId);
    if (fs.existsSync(metaPath)) {
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }

    const versionManifest = await getVersionManifest(versionId);
    fs.mkdirSync(getBuildVersionDir(buildId, versionId), { recursive: true });
    fs.writeFileSync(metaPath, JSON.stringify(versionManifest, null, 2));
    return versionManifest;
}

async function fetchFabricLoaderProfile(gameVersion) {
    const loaderVersions = await fetchJson(`${FABRIC_META_BASE}/versions/loader/${encodeURIComponent(gameVersion)}`);
    const selectedLoader = (loaderVersions || []).find((entry) => entry?.loader?.stable) || loaderVersions?.[0];

    if (!selectedLoader?.loader?.version) {
        throw new Error(`Не удалось подобрать Fabric loader для ${gameVersion}.`);
    }

    return fetchJson(`${FABRIC_META_BASE}/versions/loader/${encodeURIComponent(gameVersion)}/${encodeURIComponent(selectedLoader.loader.version)}/profile/json`);
}

async function fetchText(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        const message = (await response.text()).trim() || `HTTP ${response.status}`;
        throw new Error(message);
    }

    return response.text();
}

function compareForgeVersionParts(leftVersion, rightVersion) {
    const leftParts = String(leftVersion || '').split(/[\.-]/);
    const rightParts = String(rightVersion || '').split(/[\.-]/);
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < maxLength; index += 1) {
        const leftPart = leftParts[index] || '';
        const rightPart = rightParts[index] || '';
        const leftNumber = Number(leftPart);
        const rightNumber = Number(rightPart);
        const leftIsNumber = leftPart !== '' && Number.isFinite(leftNumber);
        const rightIsNumber = rightPart !== '' && Number.isFinite(rightNumber);

        if (leftIsNumber && rightIsNumber && leftNumber !== rightNumber) {
            return leftNumber - rightNumber;
        }

        if (leftPart !== rightPart) {
            return leftPart.localeCompare(rightPart, undefined, { numeric: true, sensitivity: 'base' });
        }
    }

    return 0;
}

async function fetchForgeVersionFromMavenMetadata(gameVersion) {
    const xml = await fetchText(FORGE_MAVEN_METADATA_URL);
    const versions = Array.from(xml.matchAll(/<version>([^<]+)<\/version>/g), (match) => match[1]?.trim())
        .filter(Boolean)
        .filter((version) => version.startsWith(`${gameVersion}-`));

    if (!versions.length) {
        return '';
    }

    const stableVersions = versions.filter((version) => {
        const loaderVersion = version.slice(`${gameVersion}-`.length);
        return !/[a-z]/i.test(loaderVersion);
    });
    const candidates = stableVersions.length ? stableVersions : versions;
    const selectedVersion = candidates.sort((left, right) => {
        const leftLoaderVersion = left.slice(`${gameVersion}-`.length);
        const rightLoaderVersion = right.slice(`${gameVersion}-`.length);
        return compareForgeVersionParts(leftLoaderVersion, rightLoaderVersion);
    }).at(-1);

    return selectedVersion ? selectedVersion.slice(`${gameVersion}-`.length) : '';
}

async function fetchForgeVersion(gameVersion) {
    try {
        const promotions = await fetchJson(FORGE_PROMOTIONS_URL);
        const promos = promotions?.promos || {};
        const promotedVersion = promos[`${gameVersion}-recommended`] || promos[`${gameVersion}-latest`] || '';
        if (promotedVersion) {
            return promotedVersion;
        }
    } catch (error) {
        console.warn(`Forge promotions lookup failed for ${gameVersion}: ${error.message}`);
    }

    return fetchForgeVersionFromMavenMetadata(gameVersion);
}

function getForgeInstallerUrl(gameVersion, forgeVersion) {
    const fullVersion = `${gameVersion}-${forgeVersion}`;
    return `${FORGE_MAVEN_BASE}/net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-installer.jar`;
}

function updateBuildMeta(buildId, patch = {}) {
    const current = readBuildMeta(buildId);
    if (!current) {
        throw new Error('Сборка не найдена.');
    }

    const nextMeta = {
        ...current,
        ...(patch || {})
    };
    fs.writeFileSync(getBuildMetaPath(buildId), JSON.stringify(nextMeta, null, 2));
    return nextMeta;
}

function getJavaToolPath(javaExecutable, toolName) {
    const executableName = process.platform === 'win32' ? `${toolName}.exe` : toolName;
    const javaBinDir = path.dirname(String(javaExecutable || ''));
    const siblingTool = path.join(javaBinDir, executableName);
    return fs.existsSync(siblingTool) ? siblingTool : '';
}

async function ensureForgeInstallerLauncherFiles(build, onStatus) {
    const minecraftVersion = build.minecraftVersion || DEFAULT_GAME_VERSION;
    const vanillaMeta = await ensureVersionMetadata(build.id, minecraftVersion);

    onStatus?.({
        stage: 'download',
        status: 'running',
        title: 'Подготовка vanilla runtime',
        detail: minecraftVersion,
        progress: 8
    });

    await ensureClientJar(build, vanillaMeta, ({ downloadedBytes, totalBytes, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание vanilla клиента',
            detail: `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes || downloadedBytes)}`,
            speedBytes,
            progress: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 12
        });
    });

    const launcherProfilesPath = path.join(build.path, 'launcher_profiles.json');
    if (!fs.existsSync(launcherProfilesPath)) {
        fs.writeFileSync(launcherProfilesPath, JSON.stringify({
            profiles: {},
            settings: {},
            version: 3
        }, null, 2));
    }
}

async function runForgeInstallerCli(javaExecutable, installerJarPath, installDir, onStatus, fullVersion) {
    const installArgs = ['-jar', installerJarPath, '--installClient', installDir];
    return new Promise((resolve, reject) => {
        const child = spawn(javaExecutable, installArgs, {
            cwd: installDir,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (chunk) => {
            const text = String(chunk || '');
            stdout += text;
            onStatus?.({
                stage: 'download',
                status: 'running',
                title: 'Установка Forge',
                detail: text.trim().slice(-180) || fullVersion,
                progress: 55
            });
        });

        child.stderr?.on('data', (chunk) => {
            const text = String(chunk || '');
            stderr += text;
            onStatus?.({
                stage: 'download',
                status: 'running',
                title: 'Forge installer',
                detail: text.trim().slice(-180) || fullVersion,
                progress: 55
            });
        });

        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
                return;
            }

            const error = new Error(stderr.trim() || stdout.trim() || `Forge installer завершился с кодом ${code}.`);
            error.code = code;
            error.stdout = stdout;
            error.stderr = stderr;
            reject(error);
        });
    });
}

async function runForgeInstallerClientFallback(javaExecutable, installerJarPath, installDir, helperDir, onStatus, fullVersion) {
    const helperSourcePath = path.join(helperDir, 'ForgeClientInstallHelper.java');
    const helperClassPath = path.join(helperDir, 'ForgeClientInstallHelper.class');
    const helperSource = `import java.io.File;
import com.google.common.base.Predicates;
import net.minecraftforge.installer.InstallerAction;

public class ForgeClientInstallHelper {
    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Missing install directory.");
            System.exit(2);
        }

        try {
            File installDir = new File(args[0]);
            boolean result = InstallerAction.CLIENT.run(installDir, Predicates.alwaysTrue());
            if (!result) {
                String message = InstallerAction.CLIENT.getFileError(installDir);
                if (message == null || message.trim().isEmpty()) {
                    message = "Forge client installation returned false.";
                }
                System.err.println(message);
                System.exit(1);
            }

            String message = InstallerAction.CLIENT.getSuccessMessage();
            if (message != null && !message.trim().isEmpty()) {
                System.out.println(message);
            }
        } catch (Throwable error) {
            error.printStackTrace();
            System.exit(1);
        }
    }
}
`;

    fs.mkdirSync(helperDir, { recursive: true });
    fs.writeFileSync(helperSourcePath, helperSource, 'utf-8');

    const javacExecutable = getJavaToolPath(javaExecutable, 'javac') || 'javac';
    const compileArgs = ['-cp', installerJarPath, '-d', helperDir, helperSourcePath];

    await new Promise((resolve, reject) => {
        const child = spawn(javacExecutable, compileArgs, {
            cwd: helperDir,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let stderr = '';

        child.stderr?.on('data', (chunk) => {
            stderr += String(chunk || '');
        });

        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0 && fs.existsSync(helperClassPath)) {
                resolve();
                return;
            }

            reject(new Error(stderr.trim() || `Не удалось подготовить helper для Forge installer (код ${code}).`));
        });
    });

    const classPathSeparator = process.platform === 'win32' ? ';' : ':';
    const launchArgs = ['-cp', `${helperDir}${classPathSeparator}${installerJarPath}`, 'ForgeClientInstallHelper', installDir];

    return new Promise((resolve, reject) => {
        const child = spawn(javaExecutable, launchArgs, {
            cwd: installDir,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (chunk) => {
            const text = String(chunk || '');
            stdout += text;
            onStatus?.({
                stage: 'download',
                status: 'running',
                title: 'Установка Forge (fallback)',
                detail: text.trim().slice(-180) || fullVersion,
                progress: 58
            });
        });

        child.stderr?.on('data', (chunk) => {
            const text = String(chunk || '');
            stderr += text;
            onStatus?.({
                stage: 'download',
                status: 'running',
                title: 'Forge installer (fallback)',
                detail: text.trim().slice(-180) || fullVersion,
                progress: 58
            });
        });

        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
                return;
            }

            const error = new Error(stderr.trim() || stdout.trim() || `Forge fallback installer завершился с кодом ${code}.`);
            error.code = code;
            error.stdout = stdout;
            error.stderr = stderr;
            reject(error);
        });
    });
}

async function ensureForgeInstalled(build, javaExecutable, onStatus) {
    const cachedVersionId = String(build.runtimeVersionId || '').trim();
    if (cachedVersionId && fs.existsSync(getBuildVersionMetaPath(build.id, cachedVersionId))) {
        return cachedVersionId;
    }

    const forgeVersion = build.loaderVersion || await fetchForgeVersion(build.minecraftVersion || DEFAULT_GAME_VERSION);
    if (!forgeVersion) {
        throw new Error(`Не удалось подобрать Forge для ${build.minecraftVersion}.`);
    }

    const fullVersion = `${build.minecraftVersion}-${forgeVersion}`;
    const installerDir = path.join(getBuildDir(build.id), '.forge-installer');
    const installerJarPath = path.join(installerDir, `forge-${fullVersion}-installer.jar`);
    const helperDir = path.join(installerDir, 'helper');
    fs.mkdirSync(installerDir, { recursive: true });

    onStatus?.({
        stage: 'download',
        status: 'running',
        title: 'Подготовка Forge installer',
        detail: fullVersion,
        progress: 4
    });

    await downloadArtifactIfNeeded({
        url: getForgeInstallerUrl(build.minecraftVersion, forgeVersion),
        size: 0
    }, installerJarPath, ({ downloadedBytes, totalBytes, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание Forge installer',
            detail: `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes || downloadedBytes)}`,
            speedBytes,
            progress: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 10
        });
    });

    await ensureForgeInstallerLauncherFiles(build, onStatus);

    const beforeVersions = new Set(fs.readdirSync(getBuildVersionsDir(build.id), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name));
    try {
        await runForgeInstallerCli(javaExecutable, installerJarPath, build.path, onStatus, fullVersion);
    } catch (error) {
        const combinedOutput = `${error.stderr || ''}\n${error.stdout || ''}`.toLowerCase();
        const needsFallback = combinedOutput.includes('unrecognizedoptionexception')
            || combinedOutput.includes('not a recognized option')
            || combinedOutput.includes('unrecognized option');

        if (!needsFallback) {
            throw error;
        }

        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Forge installer',
            detail: 'CLI не поддерживается, пробую совместимый fallback',
            progress: 57
        });

        await runForgeInstallerClientFallback(javaExecutable, installerJarPath, build.path, helperDir, onStatus, fullVersion);
    }

    const afterVersions = fs.readdirSync(getBuildVersionsDir(build.id), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    const newVersionId = afterVersions.find((name) => !beforeVersions.has(name) && /forge/i.test(name))
        || afterVersions.find((name) => name === fullVersion && fs.existsSync(getBuildVersionMetaPath(build.id, name)))
        || afterVersions.find((name) => /forge/i.test(name) && fs.existsSync(getBuildVersionMetaPath(build.id, name)));

    if (!newVersionId) {
        throw new Error('Forge installer не создал version json для запуска.');
    }

    updateBuildMeta(build.id, {
        loaderVersion: forgeVersion,
        runtimeVersionId: newVersionId
    });

    return newVersionId;
}

async function ensureFabricVersionMetadata(build) {
    const fabricProfile = await fetchFabricLoaderProfile(build.minecraftVersion || DEFAULT_GAME_VERSION);
    if (!fabricProfile?.id) {
        throw new Error('Fabric profile не содержит id.');
    }

    const metaPath = getBuildVersionMetaPath(build.id, fabricProfile.id);
    fs.mkdirSync(getBuildVersionDir(build.id, fabricProfile.id), { recursive: true });
    fs.writeFileSync(metaPath, JSON.stringify(fabricProfile, null, 2));
    return fabricProfile;
}

async function resolveVersionHierarchy(build, versionId, accumulator = []) {
    const meta = await ensureVersionMetadata(build.id, versionId);
    if (meta.inheritsFrom) {
        await resolveVersionHierarchy(build, meta.inheritsFrom, accumulator);
    }

    accumulator.push(meta);
    return accumulator;
}

function mergeVersionHierarchy(chain = []) {
    return chain.reduce((merged, meta) => {
        const next = { ...merged, ...meta };
        next.libraries = [...(merged.libraries || []), ...(meta.libraries || [])];

        const mergedArguments = {
            game: [...(merged.arguments?.game || [])],
            jvm: [...(merged.arguments?.jvm || [])]
        };

        if (Array.isArray(meta.arguments?.game)) {
            mergedArguments.game = [...mergedArguments.game, ...meta.arguments.game];
        }
        if (Array.isArray(meta.arguments?.jvm)) {
            mergedArguments.jvm = [...mergedArguments.jvm, ...meta.arguments.jvm];
        }

        next.arguments = mergedArguments;
        next.logging = {
            ...(merged.logging || {}),
            ...(meta.logging || {})
        };

        return next;
    }, {});
}

async function ensureClientJar(build, versionMeta, onProgress) {
    const versionId = versionMeta.id || build.minecraftVersion || DEFAULT_GAME_VERSION;
    const jarPath = getBuildVersionJarPath(build.id, versionId);
    if (versionMeta?.downloads?.client?.url) {
        await downloadArtifactIfNeeded(versionMeta.downloads.client, jarPath, onProgress);
    }

    return jarPath;
}

async function ensureAssetIndex(versionMeta, onProgress) {
    if (!versionMeta?.assetIndex?.url || !versionMeta?.assetIndex?.id) {
        throw new Error('В version json отсутствует asset index.');
    }

    const assetIndexPath = getAssetIndexPath(versionMeta.assetIndex.id);
    await downloadArtifactIfNeeded(versionMeta.assetIndex, assetIndexPath, onProgress);
    return {
        path: assetIndexPath,
        data: JSON.parse(fs.readFileSync(assetIndexPath, 'utf-8'))
    };
}

async function ensureAssets(assetIndexData, onProgress) {
    const objects = Object.entries(assetIndexData?.objects || {});
    let completed = 0;
    let downloadedBytes = 0;
    let lastBytes = 0;
    let lastTime = Date.now();

    for (const [, asset] of objects) {
        if (!asset?.hash) {
            completed += 1;
            continue;
        }

        const prefix = asset.hash.slice(0, 2);
        const destination = path.join(getAssetsObjectsDir(), prefix, asset.hash);
        let assetDownloaded = 0;
        await downloadArtifactIfNeeded({
            url: `https://resources.download.minecraft.net/${prefix}/${asset.hash}`,
            size: asset.size || 0
        }, destination, ({ downloadedBytes: currentBytes = 0 }) => {
            assetDownloaded = Math.max(assetDownloaded, Number(currentBytes) || 0);
        });

        completed += 1;
        downloadedBytes += assetDownloaded || Number(asset.size || 0);
        const now = Date.now();
        const elapsed = Math.max(1, now - lastTime);
        const speedBytes = Math.round(((downloadedBytes - lastBytes) / elapsed) * 1000);
        lastBytes = downloadedBytes;
        lastTime = now;
        onProgress?.({
            completed,
            total: objects.length,
            currentName: asset.hash,
            speedBytes
        });
    }
}

async function ensureLibraries(versionMeta, onProgress, options = {}) {
    const features = {};
    const libraries = [];
    const nativeEntries = [];
    const seenClassPathEntries = new Set();
    const libraryRoots = Array.isArray(options.libraryRoots) && options.libraryRoots.length
        ? options.libraryRoots
        : [librariesRoot];
    let completed = 0;
    const filteredLibraries = (versionMeta.libraries || []).filter((library) => isAllowedByRules(library.rules, features));
    const keptConflictKeys = new Set();
    const activeLibraries = [];

    // For inherited version chains, keep the last declared version of the same group:artifact.
    // This lets Forge-era profiles override vanilla libraries like Guava/Commons Lang.
    for (let index = filteredLibraries.length - 1; index >= 0; index -= 1) {
        const library = filteredLibraries[index];
        const conflictKey = getLibraryConflictKey(library);

        if (conflictKey && keptConflictKeys.has(conflictKey)) {
            continue;
        }

        if (conflictKey) {
            keptConflictKeys.add(conflictKey);
        }

        activeLibraries.unshift(library);
    }

    for (const library of activeLibraries) {
        const artifactDownload = getLibraryArtifactDownload(library);
        const artifactPath = artifactDownload?.path || getLibraryArtifactPath(library);
        if (artifactPath) {
            let destination = libraryRoots
                .map((root) => path.join(root, artifactPath))
                .find((candidate) => fs.existsSync(candidate));

            if (!destination) {
                if (!artifactDownload?.url) {
                    completed += 1;
                    onProgress?.({
                        completed,
                        total: activeLibraries.length,
                        currentName: library.name || 'library'
                    });
                    continue;
                }

                destination = path.join(librariesRoot, artifactPath);
                await downloadArtifactIfNeeded(artifactDownload, destination);
            }

            if (!seenClassPathEntries.has(destination)) {
                libraries.push(destination);
                seenClassPathEntries.add(destination);
            }
        }

        const nativeClassifier = resolveNativeClassifier(library);
        if (nativeClassifier && library?.downloads?.classifiers?.[nativeClassifier]) {
            const classifierDownload = library.downloads.classifiers[nativeClassifier];
            let destination = libraryRoots
                .map((root) => path.join(root, classifierDownload.path))
                .find((candidate) => fs.existsSync(candidate));

            if (!destination) {
                destination = path.join(librariesRoot, classifierDownload.path);
                await downloadArtifactIfNeeded(classifierDownload, destination);
            }

            nativeEntries.push({
                jarPath: destination,
                exclude: library.extract?.exclude || []
            });
        }

        completed += 1;
        onProgress?.({
            completed,
            total: activeLibraries.length,
            currentName: library.name || 'library'
        });
    }

    return {
        libraries,
        nativeEntries
    };
}

function removeExtractedExcludes(rootDir, excludes = []) {
    const targets = ['META-INF', ...excludes]
        .map((item) => String(item || '').replace(/\/+$/g, ''))
        .filter(Boolean);

    for (const target of targets) {
        const destination = path.join(rootDir, target);
        if (fs.existsSync(destination)) {
            fs.rmSync(destination, { recursive: true, force: true });
        }
    }
}

async function extractNatives(nativeEntries, nativesDir) {
    fs.rmSync(nativesDir, { recursive: true, force: true });
    fs.mkdirSync(nativesDir, { recursive: true });

    for (const entry of nativeEntries) {
        await extractZip(entry.jarPath, { dir: nativesDir });
        removeExtractedExcludes(nativesDir, entry.exclude);
    }
}

async function ensureLoggingConfig(versionMeta, onProgress) {
    const clientLogging = versionMeta?.logging?.client;
    const fileInfo = clientLogging?.file;
    if (!clientLogging?.argument || !fileInfo?.id || !fileInfo?.url) {
        return null;
    }

    const destination = getLogConfigPath(fileInfo.id);
    await downloadArtifactIfNeeded(fileInfo, destination, onProgress);
    return {
        argument: clientLogging.argument,
        path: destination
    };
}

async function prepareVanillaRuntime(build, accountName, onStatus) {
    const chain = await resolveVersionHierarchy(build, build.minecraftVersion || DEFAULT_GAME_VERSION);
    const versionMeta = mergeVersionHierarchy(chain);
    const versionId = versionMeta.id || build.minecraftVersion || DEFAULT_GAME_VERSION;

    onStatus?.({
        stage: 'download',
        status: 'running',
        title: 'Подготовка runtime',
        detail: `version json ${versionId}`,
        progress: 5
    });

    const clientJarPath = await ensureClientJar(build, versionMeta, ({ downloadedBytes, totalBytes, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание клиента',
            detail: `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes || downloadedBytes)}`,
            speedBytes,
            progress: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 10
        });
    });

    const { path: assetIndexPath, data: assetIndexData } = await ensureAssetIndex(versionMeta, ({ downloadedBytes, totalBytes, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание asset index',
            detail: `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes || downloadedBytes)}`,
            speedBytes,
            progress: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 20
        });
    });

    await ensureAssets(assetIndexData, ({ completed, total, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание assets',
            detail: `${completed}/${total}`,
            speedBytes,
            progress: total ? Math.round((completed / total) * 100) : 30
        });
    });

    const { libraries, nativeEntries } = await ensureLibraries(versionMeta, ({ completed, total, currentName }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание libraries',
            detail: currentName || `${completed}/${total}`,
            progress: total ? Math.round((completed / total) * 100) : 55
        });
    });

    const nativesDir = getVersionNativesDir(build.id, versionId);
    await extractNatives(nativeEntries, nativesDir);
    onStatus?.({
        stage: 'download',
        status: 'running',
        title: 'Сборка natives',
        detail: path.basename(nativesDir),
        progress: 75
    });

    const logging = await ensureLoggingConfig(versionMeta, ({ downloadedBytes, totalBytes, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание log config',
            detail: `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes || downloadedBytes)}`,
            speedBytes,
            progress: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 85
        });
    });

    onStatus?.({
        stage: 'download',
        status: 'completed',
        title: 'Runtime готов',
        detail: `${versionId} • ${libraries.length} libraries`,
        progress: 100
    });

    const krakvaAgentPath = ensureBundledAssetFile(bundledKrakvaAgentPath, 'KrakvaAgent-runtime.jar');

    return {
        versionMeta,
        versionId,
        clientJarPath,
        assetIndexPath,
        assetIndexData,
        libraries,
        nativesDir,
        logging,
        krakvaAgentPath,
        libraryDirectory: getBuildLibrariesPath(build.id)
    };
}

async function prepareFabricRuntime(build, accountName, onStatus) {
    const fabricProfile = await ensureFabricVersionMetadata(build);
    const chain = await resolveVersionHierarchy(build, fabricProfile.id);
    const versionMeta = mergeVersionHierarchy(chain);
    const versionId = versionMeta.id || fabricProfile.id;

    onStatus?.({
        stage: 'download',
        status: 'running',
        title: 'Подготовка Fabric runtime',
        detail: `${build.minecraftVersion} • ${versionId}`,
        progress: 5
    });

    const clientJarPath = await ensureClientJar(build, versionMeta, ({ downloadedBytes, totalBytes, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание клиента',
            detail: `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes || downloadedBytes)}`,
            speedBytes,
            progress: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 10
        });
    });

    const { path: assetIndexPath, data: assetIndexData } = await ensureAssetIndex(versionMeta, ({ downloadedBytes, totalBytes, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание asset index',
            detail: `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes || downloadedBytes)}`,
            speedBytes,
            progress: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 20
        });
    });

    await ensureAssets(assetIndexData, ({ completed, total, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание assets',
            detail: `${completed}/${total}`,
            speedBytes,
            progress: total ? Math.round((completed / total) * 100) : 30
        });
    });

    const { libraries, nativeEntries } = await ensureLibraries(versionMeta, ({ completed, total, currentName }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание libraries',
            detail: currentName || `${completed}/${total}`,
            progress: total ? Math.round((completed / total) * 100) : 55
        });
    });

    const nativesDir = getVersionNativesDir(build.id, versionId);
    await extractNatives(nativeEntries, nativesDir);
    onStatus?.({
        stage: 'download',
        status: 'running',
        title: 'Сборка natives',
        detail: path.basename(nativesDir),
        progress: 75
    });

    const logging = await ensureLoggingConfig(versionMeta, ({ downloadedBytes, totalBytes, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание log config',
            detail: `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes || downloadedBytes)}`,
            speedBytes,
            progress: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 85
        });
    });

    onStatus?.({
        stage: 'download',
        status: 'completed',
        title: 'Fabric runtime готов',
        detail: `${versionId} • ${libraries.length} libraries`,
        progress: 100
    });

    const krakvaAgentPath = ensureBundledAssetFile(bundledKrakvaAgentPath, 'KrakvaAgent-runtime.jar');

    return {
        versionMeta,
        versionId,
        clientJarPath,
        assetIndexPath,
        assetIndexData,
        libraries,
        nativesDir,
        logging,
        krakvaAgentPath,
        libraryDirectory: getBuildLibrariesPath(build.id)
    };
}

async function prepareForgeRuntime(build, accountName, javaExecutable, onStatus) {
    const runtimeVersionId = await ensureForgeInstalled(build, javaExecutable, onStatus);
    const chain = await resolveVersionHierarchy(build, runtimeVersionId);
    const versionMeta = mergeVersionHierarchy(chain);
    const versionId = versionMeta.id || runtimeVersionId;

    onStatus?.({
        stage: 'download',
        status: 'running',
        title: 'Подготовка Forge runtime',
        detail: `${build.minecraftVersion} • ${versionId}`,
        progress: 5
    });

    const clientJarPath = await ensureClientJar(build, versionMeta, ({ downloadedBytes, totalBytes, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание клиента',
            detail: `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes || downloadedBytes)}`,
            speedBytes,
            progress: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 12
        });
    });

    const { path: assetIndexPath, data: assetIndexData } = await ensureAssetIndex(versionMeta, ({ downloadedBytes, totalBytes, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание asset index',
            detail: `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes || downloadedBytes)}`,
            speedBytes,
            progress: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 24
        });
    });

    await ensureAssets(assetIndexData, ({ completed, total, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание assets',
            detail: `${completed}/${total}`,
            speedBytes,
            progress: total ? Math.round((completed / total) * 100) : 36
        });
    });

    const { libraries, nativeEntries } = await ensureLibraries(versionMeta, ({ completed, total, currentName }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Подготовка Forge libraries',
            detail: currentName || `${completed}/${total}`,
            progress: total ? Math.round((completed / total) * 100) : 60
        });
    }, {
        libraryRoots: [getBuildLibrariesPath(build.id), librariesRoot]
    });

    const nativesDir = getVersionNativesDir(build.id, versionId);
    await extractNatives(nativeEntries, nativesDir);
    onStatus?.({
        stage: 'download',
        status: 'running',
        title: 'Сборка natives',
        detail: path.basename(nativesDir),
        progress: 78
    });

    const logging = await ensureLoggingConfig(versionMeta, ({ downloadedBytes, totalBytes, speedBytes }) => {
        onStatus?.({
            stage: 'download',
            status: 'running',
            title: 'Скачивание log config',
            detail: `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes || downloadedBytes)}`,
            speedBytes,
            progress: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 88
        });
    });

    onStatus?.({
        stage: 'download',
        status: 'completed',
        title: 'Forge runtime готов',
        detail: `${versionId} • ${libraries.length} libraries`,
        progress: 100
    });

    const krakvaAgentPath = ensureBundledAssetFile(bundledKrakvaAgentPath, 'KrakvaAgent-runtime.jar');

    return {
        versionMeta,
        versionId,
        clientJarPath,
        assetIndexPath,
        assetIndexData,
        libraries,
        nativesDir,
        logging,
        krakvaAgentPath,
        libraryDirectory: getBuildLibrariesPath(build.id)
    };
}

function buildLaunchArguments({ runtime, build, javaExecutable, settings, accountName, accountType }) {
    const versionMeta = runtime.versionMeta;
    if (!versionMeta?.mainClass) {
        throw new Error('В version json отсутствует mainClass для запуска клиента.');
    }

    const username = String(accountName || 'Player').trim() || 'Player';
    const uuid = createOfflineUuid(username);
    const gameDir = getBuildGameDir(build.id);
    const classpath = [...runtime.libraries, runtime.clientJarPath].join(path.delimiter);
    const isLegacyAccount = String(accountType || 'regular').toLowerCase() === 'regular';

    // user_type: 'legacy' только для MC < 1.7.2. На 1.7.2–1.16.5 нужен 'mojang',
    // иначе offline-мультиплеер не работает даже с online-mode=false.
    const mcVersionParts = String(build.minecraftVersion || '0.0').split('.').map(Number);
    const mcMajor = mcVersionParts[1] || 0;
    const mcMinor = mcVersionParts[2] || 0;
    const isVeryOldVersion = mcMajor < 7 || (mcMajor === 7 && mcMinor < 2);
    const userType = isVeryOldVersion ? 'legacy' : 'mojang';
    const offlineAccessToken = uuid.replace(/-/g, '');

    const replacements = {
        auth_player_name: username,
        version_name: runtime.versionId,
        game_directory: gameDir,
        assets_root: assetsRoot,
        assets_index_name: versionMeta.assetIndex?.id || runtime.assetIndexData?.id || runtime.versionId,
        auth_uuid: uuid,
        auth_access_token: offlineAccessToken,
        clientid: 'offline-client',
        auth_xuid: '0',
        user_type: userType,
        version_type: versionMeta.type || 'release',
        user_properties: '{}',
        natives_directory: runtime.nativesDir,
        launcher_name: 'KrakvaMCL',
        launcher_version: app.getVersion?.() || '2.0',
        classpath,
        classpath_separator: path.delimiter,
        library_directory: runtime.libraryDirectory || librariesRoot,
        game_assets: assetsRoot
    };
    const features = {
        is_demo_user: false,
        has_custom_resolution: false,
        has_quick_plays_support: false,
        is_quick_play_singleplayer: false,
        is_quick_play_multiplayer: false,
        is_quick_play_realms: false
    };

    const jvmArguments = versionMeta.arguments?.jvm?.length
        ? resolveArgumentList(versionMeta.arguments.jvm, replacements, features)
        : [];

    const hasJavaLibraryPath = jvmArguments.some((argument) => String(argument).startsWith('-Djava.library.path='));
    const hasLauncherBrand = jvmArguments.some((argument) => String(argument).startsWith('-Dminecraft.launcher.brand='));
    const hasLauncherVersion = jvmArguments.some((argument) => String(argument).startsWith('-Dminecraft.launcher.version='));
    const hasStartOnFirstThread = jvmArguments.some((argument) => String(argument) === '-XstartOnFirstThread');
    const hasClasspath = jvmArguments.some((argument, index) => {
        if (argument === '-cp' || argument === '-classpath') {
            return true;
        }

        return jvmArguments[index - 1] === '-cp'
            || jvmArguments[index - 1] === '-classpath'
            || String(argument).startsWith('-cp=')
            || String(argument).startsWith('-classpath=');
    });

    if (!hasJavaLibraryPath) {
        jvmArguments.push(interpolateValue('-Djava.library.path=${natives_directory}', replacements));
    }

    if (!hasLauncherBrand) {
        jvmArguments.push(interpolateValue('-Dminecraft.launcher.brand=${launcher_name}', replacements));
    }

    if (!hasLauncherVersion) {
        jvmArguments.push(interpolateValue('-Dminecraft.launcher.version=${launcher_version}', replacements));
    }

    if (process.platform === 'darwin' && !hasStartOnFirstThread) {
        jvmArguments.unshift('-XstartOnFirstThread');
    }

    // authlib-injector идёт ПЕРВЫМ через unshift — перехватывает Yggdrasil до инициализации MC
    const authlibInjectorPath = ensureBundledAssetFile(bundledAuthlibInjectorPath, 'authlib-injector-1.2.7.jar');
    if (authlibInjectorPath && !jvmArguments.some(a => String(a).includes('authlib-injector'))) {
        jvmArguments.unshift(`-javaagent:${authlibInjectorPath}=${AUTHLIB_INJECTOR_AUTH_SERVER}`);
    }

    // KrakvaAgent после authlib-injector
    if (runtime.krakvaAgentPath && !jvmArguments.some(a => String(a).includes('KrakvaAgent'))) {
        jvmArguments.push(`-javaagent:${runtime.krakvaAgentPath}`);
    }

    if (!hasClasspath) {
        jvmArguments.push('-cp', classpath);
    }

    const gameArguments = versionMeta.arguments?.game?.length
        ? resolveArgumentList(versionMeta.arguments.game, replacements, features)
        : parseLegacyArguments(versionMeta.minecraftArguments).map((value) => interpolateValue(value, replacements));

    const hasResolutionArguments = gameArguments.some((argument, index) => {
        const current = String(argument);
        const previous = String(gameArguments[index - 1] || '');
        return current === '--width'
            || current === '--height'
            || previous === '--width'
            || previous === '--height'
            || current.startsWith('--width=')
            || current.startsWith('--height=');
    });

    if (isLegacyMacWindowedBuild(build) && !hasResolutionArguments) {
        gameArguments.push('--width', '1280', '--height', '720');
    }

    // '--legacy' не существует в vanilla Minecraft — убрано.
    // user_type уже передан через replacements выше.

    if (runtime.logging?.argument && runtime.logging?.path) {
        jvmArguments.push(interpolateValue(runtime.logging.argument, {
            ...replacements,
            path: runtime.logging.path
        }));
    }

    const memoryArgument = `-Xmx${Math.max(1024, Number(settings.memoryMb) || 2048)}M`;
    const command = [
        memoryArgument,
        ...jvmArguments,
        versionMeta.mainClass,
        ...gameArguments
    ];

    return {
        command,
        commandLine: [javaExecutable, ...command].join(' '),
        mainClass: versionMeta.mainClass,
        classpath,
        username,
        uuid
    };
}

function requiresTranslatedMacLaunch(versionMeta = {}) {
    if (process.platform !== 'darwin' || process.arch !== 'arm64') {
        return false;
    }

    return (versionMeta.libraries || []).some((library) => {
        const classifiers = Object.keys(library?.downloads?.classifiers || {});
        const osxNative = String(library?.natives?.osx || '');
        const hasArmNative = classifiers.some((key) => key.includes('arm64') || key.includes('aarch64'));
        const hasLegacyMacNative = osxNative === 'natives-macos' || osxNative === 'natives-osx';
        return hasLegacyMacNative && !hasArmNative;
    });
}

async function ensureRosettaAvailable(onStatus) {
    if (process.platform !== 'darwin' || process.arch !== 'arm64') {
        return;
    }

    const probe = spawnSync('/usr/bin/arch', ['-x86_64', '/usr/bin/true'], {
        encoding: 'utf8',
        timeout: 20000
    });
    if (probe.status === 0) {
        return;
    }

    onStatus?.({
        stage: 'java',
        status: 'running',
        title: 'Подготовка Rosetta',
        detail: 'macOS устанавливает поддержку x86_64',
        progress: 18
    });

    const installRosetta = spawnSync('/usr/sbin/softwareupdate', ['--install-rosetta', '--agree-to-license'], {
        encoding: 'utf8',
        timeout: 1000 * 60 * 15
    });

    const combinedOutput = `${installRosetta.stdout || ''}\n${installRosetta.stderr || ''}`;
    const rosettaInstalled = installRosetta.status === 0
        || /already installed/i.test(combinedOutput)
        || /not available/i.test(combinedOutput);

    if (!rosettaInstalled) {
        throw new Error(
            'Не удалось автоматически установить Rosetta для запуска x86_64 Java. ' +
            'Откройте Терминал и выполните: softwareupdate --install-rosetta --agree-to-license'
        );
    }
}

async function resolveLaunchProcess(javaExecutable, runtime, build, onStatus) {
    if (requiresTranslatedMacLaunch(runtime?.versionMeta)) {
        const currentInfo = inspectJavaArchitecture(javaExecutable, true);
        let resolvedJava = javaExecutable;

        if (currentInfo.arch !== 'x86_64') {
            const requiredMajor = getRequiredJavaMajor(build, runtime?.versionMeta);
            let fallback = getJavaCandidates(requiredMajor).find((candidate) => {
                return candidate.majorVersion === requiredMajor
                    && inspectJavaArchitecture(candidate.value, true).arch === 'x86_64';
            });

            if (!fallback?.value) {
                onStatus?.({
                    stage: 'java',
                    status: 'running',
                    title: 'Подготовка x86_64 Java',
                    detail: `Старая версия Minecraft требует Java ${requiredMajor} под Rosetta`,
                    progress: 10
                });

                await ensureRosettaAvailable(onStatus);
                const managedX64 = await ensureManagedJavaRuntime(requiredMajor, onStatus, 'x64');
                fallback = {
                    value: managedX64.javaPath
                };
            }

            if (fallback?.value) {
                resolvedJava = fallback.value;
            } else {
                throw new Error(
                    'Для старых версий Minecraft на Apple Silicon нужна x86_64 Java. ' +
                    'Сейчас у вас установлены только arm64 JDK, поэтому старые LWJGL natives не запускаются. ' +
                    'Установите x86_64 Java через Rosetta и выберите её в настройках лаунчера. ' +
                    'Для 1.7.10 лучше использовать x86_64 Java 8.'
                );
            }
        }

        return {
            executable: '/usr/bin/arch',
            argsPrefix: ['-x86_64', resolvedJava],
            displayExecutable: `/usr/bin/arch -x86_64 ${resolvedJava}`
        };
    }

    return {
        executable: javaExecutable,
        argsPrefix: [],
        displayExecutable: javaExecutable
    };
}

function focusMinecraftWindowOnMac() {
    if (process.platform !== 'darwin') {
        return;
    }

    const script = [
        'tell application "System Events"',
        'repeat with procName in {"java", "Minecraft", "launcherwrapper"}',
        'try',
        'set frontmost of first process whose name is procName to true',
        'exit repeat',
        'end try',
        'end repeat',
        'end tell'
    ].join('\n');

    const child = spawn('osascript', ['-e', script], {
        stdio: 'ignore',
        detached: true
    });
    child.unref();
}

async function getVersionManifest(versionId) {
    const manifest = await fetchJson(MOJANG_VERSION_MANIFEST_URL);
    const version = (manifest.versions || []).find((entry) => entry.id === versionId);

    if (!version?.url) {
        throw new Error(`Не найдена версия Minecraft ${versionId}.`);
    }

    return fetchJson(version.url);
}

async function ensureVersionDownloaded(build, onProgress) {
    const versionId = build.minecraftVersion || DEFAULT_GAME_VERSION;
    const jarPath = getBuildVersionJarPath(build.id, versionId);
    const metaPath = getBuildVersionMetaPath(build.id, versionId);

    if (fs.existsSync(jarPath) && fs.existsSync(metaPath)) {
        return {
            jarPath,
            metaPath,
            versionId,
            downloaded: false
        };
    }

    const versionManifest = await getVersionManifest(versionId);
    if (!versionManifest?.downloads?.client?.url) {
        throw new Error(`У версии ${versionId} нет client jar для скачивания.`);
    }

    fs.mkdirSync(getBuildVersionDir(build.id, versionId), { recursive: true });
    fs.writeFileSync(metaPath, JSON.stringify(versionManifest, null, 2));

    await streamDownloadFile(versionManifest.downloads.client.url, jarPath, onProgress);

    return {
        jarPath,
        metaPath,
        versionId,
        downloaded: true
    };
}

function resolveJavaExecutable(javaPathSetting) {
    if (javaPathSetting && javaPathSetting !== 'auto' && fs.existsSync(javaPathSetting)) {
        return javaPathSetting;
    }

    const candidates = getJavaCandidates();
    return candidates[0]?.value || (process.platform === 'win32' ? 'java.exe' : 'java');
}

function inspectJavaArchitecture(javaExecutable, forceX64 = false) {
    const javaPath = String(javaExecutable || '').trim();
    if (!javaPath) {
        return { arch: '', raw: '' };
    }

    const runner = forceX64 ? '/usr/bin/arch' : javaPath;
    const args = forceX64
        ? ['-x86_64', javaPath, '-XshowSettings:properties', '-version']
        : ['-XshowSettings:properties', '-version'];
    const result = spawnSync(runner, args, {
        encoding: 'utf8',
        timeout: 15000
    });
    const raw = `${result.stdout || ''}\n${result.stderr || ''}`;
    const matchedArch = raw.match(/^\s*os\.arch\s*=\s*(.+)$/m);

    return {
        arch: String(matchedArch?.[1] || '').trim().toLowerCase(),
        raw
    };
}

async function downloadVersionForBuild(buildId = null) {
    const build = buildId ? readBuild(buildId) : getActiveBuild();

    if (!build) {
        throw new Error('Сборка не найдена.');
    }

    const loader = String(build.loader || '').toLowerCase();
    if (!['vanilla', 'fabric', 'forge'].includes(loader)) {
        throw new Error(`Реальный runtime пока поддержан только для vanilla, fabric и forge. Loader "${build.loader}" ещё не реализован.`);
    }

    emitGameStatus({
        stage: 'download',
        status: 'preparing',
        title: 'Подготовка версии',
        detail: `${build.minecraftVersion} • ${build.loader}`,
        progress: 0
    });

    const settings = loadSettings();
    const javaRuntime = loader === 'forge'
        ? await resolveJavaRuntimeForBuild(build, settings, (payload) => emitGameStatus(payload))
        : null;

    const result = loader === 'fabric'
        ? await prepareFabricRuntime(build, 'Player', (payload) => emitGameStatus(payload))
        : loader === 'forge'
            ? await prepareForgeRuntime(build, 'Player', javaRuntime.javaExecutable, (payload) => emitGameStatus(payload))
            : await prepareVanillaRuntime(build, 'Player', (payload) => emitGameStatus(payload));
    await resolveJavaRuntimeForBuild(build, settings, (payload) => emitGameStatus(payload), result.versionMeta);

    emitGameStatus({
        stage: 'download',
        status: 'completed',
        title: 'Версия готова',
        detail: `${build.minecraftVersion} runtime и Java готовы`,
        progress: 100
    });

    return result;
}

async function launchGame(payload = null) {
    if (activeGameProcess) {
        throw new Error('Игра уже запущена.');
    }

    const normalizedPayload = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload
        : { buildId: payload };
    const build = normalizedPayload.buildId ? readBuild(normalizedPayload.buildId) : getActiveBuild();
    if (!build) {
        throw new Error('Сборка не найдена.');
    }

    const loader = String(build.loader || '').toLowerCase();
    if (!['vanilla', 'fabric', 'forge'].includes(loader)) {
        throw new Error(`Loader "${build.loader}" пока не поддержан для runtime-запуска. Сейчас полноценно работают vanilla, fabric и forge.`);
    }

    const settings = loadSettings();
    const accountName = String(normalizedPayload.accountName || '').trim() || 'Player';
    const accountType = String(normalizedPayload.accountType || 'regular').toLowerCase();
    const preRuntimeJava = loader === 'forge'
        ? await resolveJavaRuntimeForBuild(build, settings, (payload) => emitGameStatus(payload))
        : null;
    const runtime = loader === 'fabric'
        ? await prepareFabricRuntime(build, accountName, (statusPayload) => emitGameStatus(statusPayload))
        : loader === 'forge'
            ? await prepareForgeRuntime(build, accountName, preRuntimeJava.javaExecutable, (statusPayload) => emitGameStatus(statusPayload))
            : await prepareVanillaRuntime(build, accountName, (statusPayload) => emitGameStatus(statusPayload));
    const resolvedJava = await resolveJavaRuntimeForBuild(build, settings, (payload) => emitGameStatus(payload), runtime.versionMeta);
    const javaExecutable = resolvedJava.javaExecutable;
    const launchState = buildLaunchArguments({
        runtime,
        build,
        javaExecutable,
        settings,
        accountName,
        accountType
    });
    const launchProcess = await resolveLaunchProcess(javaExecutable, runtime, build, (payload) => emitGameStatus(payload));
    const command = launchState.command;
    ensureLegacyMacWindowedOptions(build);
    let launcherHidden = false;
    let launcherHiding = false;
    let gameOutputObserved = false;
    const hideWindowIfReady = async (outputText = '') => {
        if (launcherHidden || launcherHiding || !settings.minimizeToTrayOnLaunch || !mainWindow || mainWindow.isDestroyed()) {
            return;
        }

        const text = String(outputText || '').trim();
        if (!text) {
            return;
        }

        gameOutputObserved = true;
        if (/(lwjgl|backend library|render thread|display|window|minecraft client|openal|gl version|startup|starting minecraft)/i.test(text)) {
            launcherHiding = true;
            await hideLauncherWindowAnimated();
            launcherHidden = true;
            launcherHiding = false;
        }
    };

    emitGameStatus({
        stage: 'launch',
        status: 'starting',
        title: 'Запуск игры',
        detail: `${launchState.username} • ${launchState.mainClass}`,
        command: [launchProcess.displayExecutable, ...command].join(' '),
        progress: 100
    });
    updateDiscordPresence({
        gameRunning: true,
        gameVersion: build.minecraftVersion || '',
        buildName: build.name || build.id || '',
        launchTitle: 'Запуск игры',
        launchDetail: `${build.loader || 'vanilla'} ${build.minecraftVersion || ''}`.trim()
    });

    const stdoutChunks = [];
    const stderrChunks = [];
    activeGameProcess = spawn(launchProcess.executable, [...launchProcess.argsPrefix, ...command], {
        cwd: getBuildGameDir(build.id),
        stdio: ['ignore', 'pipe', 'pipe']
    });

    if (isLegacyMacWindowedBuild(build)) {
        setTimeout(() => focusMinecraftWindowOnMac(), 2500);
        setTimeout(() => focusMinecraftWindowOnMac(), 5000);
    }

    const hideTimer = setTimeout(() => {
        if (!launcherHidden && !launcherHiding && gameOutputObserved && settings.minimizeToTrayOnLaunch && mainWindow && !mainWindow.isDestroyed()) {
            launcherHiding = true;
            hideLauncherWindowAnimated()
                .then(() => {
                    launcherHidden = true;
                })
                .finally(() => {
                    launcherHiding = false;
                });
        }
    }, 7000);

    activeGameProcess.stdout?.on('data', (chunk) => {
        const text = String(chunk || '');
        stdoutChunks.push(text);
        hideWindowIfReady(text);
        emitGameStatus({
            stage: 'launch',
            status: 'running',
            title: 'Игра запущена',
            detail: text.trim().slice(-180) || 'Процесс активен'
        });
        updateDiscordPresence({
            gameRunning: true,
            gameVersion: build.minecraftVersion || '',
            buildName: build.name || build.id || '',
            launchTitle: 'Игра запущена',
            launchDetail: text.trim().slice(-180) || 'Процесс активен'
        });
    });

    activeGameProcess.stderr?.on('data', (chunk) => {
        const text = String(chunk || '');
        stderrChunks.push(text);
        hideWindowIfReady(text);
        emitGameStatus({
            stage: 'launch',
            status: 'running',
            title: 'Логи запуска',
            detail: text.trim().slice(-180) || 'Чтение stderr'
        });
        updateDiscordPresence({
            gameRunning: true,
            gameVersion: build.minecraftVersion || '',
            buildName: build.name || build.id || '',
            launchTitle: 'Логи запуска',
            launchDetail: text.trim().slice(-180) || 'Чтение stderr'
        });
    });

    activeGameProcess.on('error', async (error) => {
        clearTimeout(hideTimer);
        activeGameProcess = null;
        const report = createCrashReport({
            build,
            command: [launchProcess.displayExecutable, ...command],
            exitCode: 'spawn-error',
            stdout: stdoutChunks.join(''),
            stderr: `${stderrChunks.join('')}\n${error.message}`
        });
        emitGameStatus({
            stage: 'launch',
            status: 'error',
            title: 'Ошибка запуска',
            detail: report.reason,
            reportPath: report.filePath
        });
        updateDiscordPresence({
            gameRunning: false,
            launchTitle: 'Ошибка запуска',
            launchDetail: report.reason
        });
        if (mainWindow && !mainWindow.isDestroyed()) {
            await showLauncherWindowAnimated();
        }
    });

    activeGameProcess.on('close', async (code) => {
        clearTimeout(hideTimer);
        const stdout = stdoutChunks.join('');
        const stderr = stderrChunks.join('');
        activeGameProcess = null;

        if (code === 0) {
            emitGameStatus({
                stage: 'exit',
                status: 'completed',
                title: 'Игра завершилась',
                detail: 'Процесс завершился без ошибок',
                exitCode: code
            });
            updateDiscordPresence({
                gameRunning: false,
                launchTitle: 'Игра завершилась',
                launchDetail: 'Процесс завершился без ошибок'
            });
        } else {
            const report = createCrashReport({
                build,
                command: [launchProcess.displayExecutable, ...command],
                exitCode: code,
                stdout,
                stderr
            });
            emitGameStatus({
                stage: 'exit',
                status: 'error',
                title: 'Обнаружен краш',
                detail: report.reason,
                exitCode: code,
                reportPath: report.filePath
            });
            updateDiscordPresence({
                gameRunning: false,
                launchTitle: 'Обнаружен краш',
                launchDetail: report.reason
            });
        }

        if (settings.reopenLauncherOnGameExit && mainWindow && !mainWindow.isDestroyed()) {
            await showLauncherWindowAnimated();
        }
    });

    return {
        pid: activeGameProcess.pid,
        build,
        jarPath: runtime.clientJarPath,
        command: [launchProcess.displayExecutable, ...command]
    };
}

function getGameState() {
    return {
        running: Boolean(activeGameProcess),
        pid: activeGameProcess?.pid || null,
        latestCrashReportPath
    };
}

async function openCrashReport(filePath = '') {
    const target = filePath || latestCrashReportPath;
    if (!target || !fs.existsSync(target)) {
        throw new Error('Файл отчёта не найден.');
    }

    const result = await shell.openPath(target);
    if (result) {
        throw new Error(result);
    }

    return target;
}

function buildExportPayload(buildId) {
    const build = readBuild(buildId);
    if (!build) {
        throw new Error('Сборка не найдена.');
    }

    const mods = listInstalledMods(build.id).mods.map((mod) => ({
        projectId: mod.projectId || '',
        title: mod.title,
        author: mod.author,
        versionName: mod.versionName || '',
        source: mod.source || 'file',
        enabled: mod.enabled,
        filename: mod.filename
    }));

    return {
        format: 'KrakvaMCL-BuildExport',
        version: 1,
        exportedAt: new Date().toISOString(),
        build: {
            name: build.name,
            minecraftVersion: build.minecraftVersion,
            loader: build.loader
        },
        mods
    };
}

async function exportBuildToFile(buildId) {
    const payload = buildExportPayload(buildId);
    const result = await dialog.showSaveDialog({
        title: 'Экспорт сборки',
        defaultPath: `${payload.build.name || buildId}.krakvamcl-build.json`,
        filters: [{ name: 'KrakvaMCL Build', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePath) {
        return null;
    }

    fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return result.filePath;
}

async function importBuildFromPayload(payload) {
    if (payload?.format !== 'KrakvaMCL-BuildExport' || !payload?.build) {
        throw new Error('Неверный JSON ключ сборки.');
    }

    const created = createBuild({
        name: payload.build.name || 'Imported Build',
        minecraftVersion: payload.build.minecraftVersion || DEFAULT_GAME_VERSION,
        loader: payload.build.loader || DEFAULT_LOADER
    });

    for (const mod of payload.mods || []) {
        if (!mod?.projectId) {
            continue;
        }

        try {
            await downloadMod({
                modId: mod.projectId,
                gameVersion: created.minecraftVersion,
                loader: created.loader,
                title: mod.title || '',
                author: mod.author || ''
            });

            if (mod.enabled === false) {
                const installed = listInstalledMods(created.id).mods.find((item) => String(item.projectId || '') === String(mod.projectId));
                if (installed?.enabled) {
                    toggleInstalledMod(installed.filename, created.id);
                }
            }
        } catch {
            // Keep import resilient even if a specific mod version is unavailable.
        }
    }

    return readBuild(created.id);
}

async function importBuildFromJsonInput(jsonText = '') {
    const payload = JSON.parse(String(jsonText || '').trim() || '{}');
    return importBuildFromPayload(payload);
}

async function importBuildFromFile() {
    const result = await dialog.showOpenDialog({
        title: 'Импорт сборки',
        properties: ['openFile'],
        filters: [{ name: 'KrakvaMCL Build', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePaths[0]) {
        return null;
    }

    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    return importBuildFromJsonInput(raw);
}

async function importBuildConfigs(buildId) {
    const build = readBuild(buildId);
    if (!build) {
        throw new Error('Сборка не найдена.');
    }

    const result = await dialog.showOpenDialog({
        title: 'Импорт конфигов сборки',
        properties: ['openDirectory']
    });

    if (result.canceled || !result.filePaths[0]) {
        return null;
    }

    const sourceDir = result.filePaths[0];
    const imported = [];

    BUILD_CONFIG_IMPORT_FILES.forEach((filename) => {
        const sourcePath = path.join(sourceDir, filename);
        if (fs.existsSync(sourcePath)) {
            copyRecursive(sourcePath, path.join(build.path, filename));
            imported.push(filename);
        }
    });

    BUILD_CONFIG_IMPORT_DIRS.forEach((dirname) => {
        const sourcePath = path.join(sourceDir, dirname);
        if (fs.existsSync(sourcePath)) {
            copyRecursive(sourcePath, path.join(build.path, dirname));
            imported.push(dirname);
        }
    });

    return {
        buildId: build.id,
        imported
    };
}

function ensureDefaultBuild() {
    ensureBuildsRoot();
    const buildId = DEFAULT_BUILD_ID;
    const buildDir = getBuildDir(buildId);
    const buildMetaPath = getBuildMetaPath(buildId);
    const meta = defaultBuildMeta();

    fs.mkdirSync(buildDir, { recursive: true });
    fs.mkdirSync(getBuildModsPath(buildId), { recursive: true });
    fs.mkdirSync(getBuildLibrariesPath(buildId), { recursive: true });
    fs.mkdirSync(getBuildVersionsDir(buildId), { recursive: true });
    fs.mkdirSync(getBuildReportsDir(buildId), { recursive: true });

    if (!fs.existsSync(buildMetaPath)) {
        fs.writeFileSync(buildMetaPath, JSON.stringify(meta, null, 2));
    } else {
        const current = readBuildMeta(buildId);
        fs.writeFileSync(buildMetaPath, JSON.stringify({ ...meta, ...current, id: buildId, isDefault: true }, null, 2));
    }
}

function readBuildMeta(buildId) {
    const metaPath = getBuildMetaPath(buildId);

    if (!fs.existsSync(metaPath)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch {
        return null;
    }
}

function readBuild(buildId) {
    const meta = readBuildMeta(buildId);

    if (!meta) {
        return null;
    }

    fs.mkdirSync(getBuildModsPath(buildId), { recursive: true });
    fs.mkdirSync(getBuildLibrariesPath(buildId), { recursive: true });
    fs.mkdirSync(getBuildVersionsDir(buildId), { recursive: true });
    fs.mkdirSync(getBuildReportsDir(buildId), { recursive: true });

    const buildPath = getBuildDir(buildId);

    return {
        id: buildId,
        name: meta.name || buildId,
        minecraftVersion: meta.minecraftVersion || DEFAULT_GAME_VERSION,
        loader: meta.loader || DEFAULT_LOADER,
        loaderVersion: meta.loaderVersion || '',
        runtimeVersionId: meta.runtimeVersionId || '',
        isDefault: Boolean(meta.isDefault),
        path: buildPath,
        modsPath: getBuildModsPath(buildId),
        librariesPath: getBuildLibrariesPath(buildId),
        versionsPath: getBuildVersionsDir(buildId),
        reportsPath: getBuildReportsDir(buildId),
        launchJarPath: getBuildVersionJarPath(buildId, meta.minecraftVersion || DEFAULT_GAME_VERSION),
        sizeBytes: getDirectorySize(buildPath)
    };
}

function listBuilds() {
    ensureDefaultBuild();

    const builds = fs.readdirSync(buildsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => readBuild(entry.name))
        .filter(Boolean)
        .sort((a, b) => {
            if (a.isDefault && !b.isDefault) {
                return -1;
            }

            if (!a.isDefault && b.isDefault) {
                return 1;
            }

            return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
        });

    if (!builds.some((build) => build.id === DEFAULT_BUILD_ID)) {
        ensureDefaultBuild();
        return listBuilds();
    }

    return builds;
}

function loadSettings() {
    migrateLegacyData();
    ensureSettingsFile();
    ensureDefaultBuild();

    try {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        const merged = { ...getDefaultSettings(), ...JSON.parse(raw) };
        const builds = listBuilds();

        if (!builds.some((build) => build.id === merged.activeBuildId)) {
            merged.activeBuildId = DEFAULT_BUILD_ID;
            fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
        }

        return merged;
    } catch {
        const fallback = getDefaultSettings();
        fs.writeFileSync(settingsPath, JSON.stringify(fallback, null, 2));
        return fallback;
    }
}

function saveSettings(nextSettings) {
    const merged = { ...getDefaultSettings(), ...nextSettings };
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
    return merged;
}

function getJavaExecutableFromHome(homeDir) {
    if (!homeDir) {
        return '';
    }

    const targetName = getJavaBinaryName();
    const directCandidate = path.join(homeDir, 'bin', targetName);
    if (fs.existsSync(directCandidate)) {
        return directCandidate;
    }

    const macCandidate = path.join(homeDir, 'Contents', 'Home', 'bin', targetName);
    if (fs.existsSync(macCandidate)) {
        return macCandidate;
    }

    return '';
}

function listJavaExecutablesFromPath() {
    const command = process.platform === 'win32' ? 'where' : 'which';
    const args = process.platform === 'win32' ? ['java'] : ['-a', 'java'];
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        timeout: 5000
    });

    if (result.status !== 0) {
        return [];
    }

    return String(result.stdout || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((candidate) => path.resolve(candidate))
        .filter((candidate, index, list) => list.indexOf(candidate) === index);
}

function listJavaHomesFromMacSystem() {
    if (process.platform !== 'darwin') {
        return [];
    }

    const result = spawnSync('/usr/libexec/java_home', ['-V'], {
        encoding: 'utf8',
        timeout: 10000
    });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;

    return output
        .split(/\r?\n/)
        .map((line) => line.match(/(\/.+)$/)?.[1] || '')
        .map((candidate) => candidate.trim())
        .filter(Boolean)
        .filter((candidate, index, list) => list.indexOf(candidate) === index);
}

function listJavaHomesFromKnownDirectories() {
    const rootDirs = [];

    if (process.platform === 'darwin') {
        rootDirs.push('/Library/Java/JavaVirtualMachines');
        rootDirs.push(path.join(os.homedir(), 'Library', 'Java', 'JavaVirtualMachines'));
    } else if (process.platform === 'win32') {
        [
            process.env.ProgramFiles,
            process.env['ProgramFiles(x86)'],
            process.env.LOCALAPPDATA
        ].filter(Boolean).forEach((baseDir) => {
            rootDirs.push(path.join(baseDir, 'Java'));
            rootDirs.push(path.join(baseDir, 'Eclipse Adoptium'));
            rootDirs.push(path.join(baseDir, 'AdoptOpenJDK'));
            rootDirs.push(path.join(baseDir, 'Zulu'));
            rootDirs.push(path.join(baseDir, 'BellSoft'));
            rootDirs.push(path.join(baseDir, 'Microsoft'));
            rootDirs.push(path.join(baseDir, 'Amazon Corretto'));
        });
    } else {
        rootDirs.push('/usr/lib/jvm');
        rootDirs.push('/usr/java');
        rootDirs.push('/opt/java');
        rootDirs.push('/opt/jdk');
    }

    const homes = new Set();

    rootDirs.forEach((rootDir) => {
        if (!rootDir || !fs.existsSync(rootDir)) {
            return;
        }

        if (getJavaExecutableFromHome(rootDir)) {
            homes.add(rootDir);
        }

        let entries = [];
        try {
            entries = fs.readdirSync(rootDir, { withFileTypes: true });
        } catch {
            return;
        }

        entries.forEach((entry) => {
            if (!entry.isDirectory()) {
                return;
            }

            const fullPath = path.join(rootDir, entry.name);
            if (getJavaExecutableFromHome(fullPath)) {
                homes.add(fullPath);
            }

            const macHome = path.join(fullPath, 'Contents', 'Home');
            if (getJavaExecutableFromHome(macHome)) {
                homes.add(macHome);
            }
        });
    });

    return Array.from(homes);
}

function buildJavaCandidateLabel(info, source = 'local') {
    const parts = [`Java ${info.majorVersion || '?'}`];

    if (info.runtimeName) {
        parts.push(info.runtimeName);
    } else if (info.vendor) {
        parts.push(info.vendor);
    }

    if (info.arch) {
        parts.push(info.arch);
    }

    if (source === 'managed') {
        parts.push('AutoJava');
    } else if (!info.compatible) {
        parts.push('несовместима с устройством');
    } else {
        parts.push('найдена в системе');
    }

    return parts.join(' • ');
}

function getJavaCandidates(requiredMajor = 0) {
    const candidates = new Map();
    const addCandidate = (javaPath, source = 'local') => {
        const resolvedPath = String(javaPath || '').trim();
        if (!resolvedPath || !fs.existsSync(resolvedPath) || candidates.has(resolvedPath)) {
            return;
        }

        const inspected = inspectJavaInstallation(resolvedPath);
        if (!inspected) {
            return;
        }

        candidates.set(resolvedPath, {
            value: resolvedPath,
            label: buildJavaCandidateLabel(inspected, source),
            source,
            majorVersion: inspected.majorVersion,
            arch: inspected.arch,
            compatible: inspected.compatible
        });
    };

    listManagedJavaCandidates().forEach((candidate) => {
        candidates.set(candidate.value, candidate);
    });

    [
        process.env.JAVA_HOME,
        process.env.JDK_HOME,
        ...listJavaHomesFromMacSystem(),
        ...listJavaHomesFromKnownDirectories()
    ].filter(Boolean).forEach((homeDir) => {
        addCandidate(getJavaExecutableFromHome(homeDir), 'local');
    });

    listJavaExecutablesFromPath().forEach((javaPath) => addCandidate(javaPath, 'local'));

    return Array.from(candidates.values()).sort((left, right) => {
        const leftRequiredScore = Number(left.compatible && (!requiredMajor || left.majorVersion === requiredMajor));
        const rightRequiredScore = Number(right.compatible && (!requiredMajor || right.majorVersion === requiredMajor));
        if (leftRequiredScore !== rightRequiredScore) {
            return rightRequiredScore - leftRequiredScore;
        }

        const leftCompatibleScore = Number(left.compatible);
        const rightCompatibleScore = Number(right.compatible);
        if (leftCompatibleScore !== rightCompatibleScore) {
            return rightCompatibleScore - leftCompatibleScore;
        }

        const leftManagedScore = Number(left.source === 'managed');
        const rightManagedScore = Number(right.source === 'managed');
        if (leftManagedScore !== rightManagedScore) {
            return rightManagedScore - leftManagedScore;
        }

        return Number(right.majorVersion || 0) - Number(left.majorVersion || 0);
    });
}

async function parseJsonResponse(response) {
    const text = await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        const errorPayload = await parseJsonResponse(response);
        const message = errorPayload.description || errorPayload.error || errorPayload.message || `HTTP ${response.status}`;
        throw new Error(message);
    }

    return response.json();
}

function parseMinecraftReleaseVersion(version = '') {
    const matched = String(version || '').match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
    if (!matched) {
        return null;
    }

    return {
        major: Number(matched[1]),
        minor: Number(matched[2]),
        patch: Number(matched[3] || 0)
    };
}

function inferJavaMajorFromGameVersion(gameVersion = '') {
    const parsed = parseMinecraftReleaseVersion(gameVersion);
    if (!parsed) {
        return 21;
    }

    if (parsed.major > 1) {
        return 21;
    }

    if (parsed.minor >= 20 && parsed.patch >= 5) {
        return 21;
    }

    if (parsed.minor >= 18) {
        return 17;
    }

    if (parsed.minor === 17) {
        return 16;
    }

    return 8;
}

function getRequiredJavaMajor(build = null, versionMeta = null) {
    const explicitMajor = Number(versionMeta?.javaVersion?.majorVersion || 0);
    if (explicitMajor >= 7) {
        return explicitMajor;
    }

    return inferJavaMajorFromGameVersion(build?.minecraftVersion || DEFAULT_GAME_VERSION);
}

function getJavaBinaryName() {
    return process.platform === 'win32' ? 'java.exe' : 'java';
}

function parseJavaMajorVersion(raw = '') {
    const text = String(raw || '');
    const quotedVersion = text.match(/version\s+"([^"]+)"/i)?.[1] || '';
    const normalized = quotedVersion.startsWith('1.')
        ? quotedVersion.split('.').slice(1)
        : quotedVersion.split(/[._-]/);
    const majorFromQuoted = Number(normalized[0] || 0);

    if (majorFromQuoted >= 1) {
        return majorFromQuoted;
    }

    const classVersion = Number(text.match(/^\s*java\.class\.version\s*=\s*(\d+)/m)?.[1] || 0);
    if (classVersion >= 45) {
        return Math.max(8, classVersion - 44);
    }

    return 0;
}

function normalizeJavaArchitecture(value = '') {
    const normalized = String(value || '').trim().toLowerCase();

    if (!normalized) {
        return '';
    }

    if (['x86_64', 'amd64', 'x64'].includes(normalized)) {
        return 'x64';
    }

    if (['aarch64', 'arm64'].includes(normalized)) {
        return 'arm64';
    }

    if (['x86', 'i386', 'i486', 'i586', 'i686'].includes(normalized)) {
        return 'x86';
    }

    return normalized;
}

function getCurrentProcessArchitecture() {
    return normalizeJavaArchitecture(process.arch);
}

function isJavaArchitectureCompatible(javaArch = '') {
    const runtimeArch = normalizeJavaArchitecture(javaArch);
    const currentArch = getCurrentProcessArchitecture();

    if (!runtimeArch || !currentArch) {
        return true;
    }

    if (process.platform === 'darwin' && currentArch === 'arm64' && runtimeArch === 'x64') {
        return true;
    }

    return runtimeArch === currentArch;
}

function inspectJavaInstallation(javaExecutable) {
    const javaPath = String(javaExecutable || '').trim();
    if (!javaPath || !fs.existsSync(javaPath)) {
        return null;
    }

    const result = spawnSync(javaPath, ['-XshowSettings:properties', '-version'], {
        encoding: 'utf8',
        timeout: 15000
    });
    const raw = `${result.stdout || ''}\n${result.stderr || ''}`;
    const majorVersion = parseJavaMajorVersion(raw);

    if (!majorVersion) {
        return null;
    }

    return {
        javaPath,
        majorVersion,
        arch: normalizeJavaArchitecture(raw.match(/^\s*os\.arch\s*=\s*(.+)$/m)?.[1] || ''),
        vendor: String(raw.match(/^\s*java\.vendor\s*=\s*(.+)$/m)?.[1] || '').trim(),
        runtimeName: String(raw.match(/^\s*java\.runtime\.name\s*=\s*(.+)$/m)?.[1] || '').trim(),
        compatible: isJavaArchitectureCompatible(raw.match(/^\s*os\.arch\s*=\s*(.+)$/m)?.[1] || ''),
        raw
    };
}

function getAdoptiumArchitecture() {
    if (process.arch === 'arm64') {
        return 'aarch64';
    }

    if (process.arch === 'ia32') {
        return 'x32';
    }

    return 'x64';
}

function getAdoptiumArchitectureForTarget(targetArch = process.arch) {
    const normalized = normalizeJavaArchitecture(targetArch);
    if (normalized === 'arm64') {
        return 'aarch64';
    }

    if (normalized === 'x86') {
        return 'x32';
    }

    return 'x64';
}

function getAdoptiumOs() {
    if (process.platform === 'darwin') {
        return 'mac';
    }

    if (process.platform === 'win32') {
        return 'windows';
    }

    return 'linux';
}

function findJavaExecutableInDirectory(rootDir) {
    if (!rootDir || !fs.existsSync(rootDir)) {
        return '';
    }

    const targetName = getJavaBinaryName();
    const preferred = [
        path.join(rootDir, 'bin', targetName),
        path.join(rootDir, 'Contents', 'Home', 'bin', targetName)
    ];

    const directMatch = preferred.find((candidate) => fs.existsSync(candidate));
    if (directMatch) {
        return directMatch;
    }

    const queue = [{ dir: rootDir, depth: 0 }];
    while (queue.length) {
        const current = queue.shift();
        let entries = [];

        try {
            entries = fs.readdirSync(current.dir, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(current.dir, entry.name);
            if (entry.isFile() && entry.name === targetName && fullPath.includes(`${path.sep}bin${path.sep}`)) {
                return fullPath;
            }

            if (entry.isDirectory() && current.depth < 5 && !entry.name.startsWith('.')) {
                queue.push({ dir: fullPath, depth: current.depth + 1 });
            }
        }
    }

    return '';
}

function readManagedJavaManifest(majorVersion, targetArch = process.arch) {
    const manifestPath = getManagedJavaManifestPath(majorVersion, targetArch);
    if (!fs.existsSync(manifestPath)) {
        return null;
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (parsed?.javaPath && fs.existsSync(parsed.javaPath)) {
            return parsed;
        }
    } catch {
        return null;
    }

    return null;
}

function listManagedJavaCandidates() {
    if (!fs.existsSync(javaRuntimesRoot)) {
        return [];
    }

    return fs.readdirSync(javaRuntimesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(javaRuntimesRoot, entry.name, 'runtime.json'))
        .filter((manifestPath) => fs.existsSync(manifestPath))
        .map((manifestPath) => {
            try {
                return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            } catch {
                return null;
            }
        })
        .filter((entry) => entry?.javaPath && fs.existsSync(entry.javaPath))
        .sort((a, b) => Number(b.majorVersion || 0) - Number(a.majorVersion || 0))
        .map((entry) => {
            const inspected = inspectJavaInstallation(entry.javaPath);

            return {
                value: entry.javaPath,
                label: buildJavaCandidateLabel(inspected || {
                    majorVersion: Number(entry.majorVersion || 0),
                    runtimeName: entry.releaseName || '',
                    arch: normalizeJavaArchitecture(entry.arch),
                    compatible: true
                }, 'managed'),
                source: 'managed',
                majorVersion: Number(entry.majorVersion || 0),
                arch: normalizeJavaArchitecture(entry.arch),
                compatible: inspected ? inspected.compatible : true
            };
        });
}

async function extractArchive(archivePath, destinationDir) {
    fs.rmSync(destinationDir, { recursive: true, force: true });
    fs.mkdirSync(destinationDir, { recursive: true });

    if (archivePath.endsWith('.zip')) {
        await extractZip(archivePath, { dir: destinationDir });
        return;
    }

    if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
        await new Promise((resolve, reject) => {
            const child = spawn('tar', ['-xzf', archivePath, '-C', destinationDir], {
                stdio: ['ignore', 'ignore', 'pipe']
            });
            let stderr = '';

            child.stderr?.on('data', (chunk) => {
                stderr += String(chunk || '');
            });
            child.on('error', reject);
            child.on('close', (code) => {
                if (code === 0) {
                    resolve();
                    return;
                }

                reject(new Error(stderr.trim() || `tar завершился с кодом ${code}.`));
            });
        });
        return;
    }

    throw new Error(`Неподдерживаемый формат архива Java: ${path.basename(archivePath)}`);
}

async function fetchManagedJavaPackage(majorVersion, targetArch = process.arch) {
    for (const imageType of ['jre', 'jdk']) {
        const url = new URL(`https://api.adoptium.net/v3/assets/latest/${encodeURIComponent(String(majorVersion))}/hotspot`);
        url.searchParams.set('architecture', getAdoptiumArchitectureForTarget(targetArch));
        url.searchParams.set('heap_size', 'normal');
        url.searchParams.set('image_type', imageType);
        url.searchParams.set('os', getAdoptiumOs());
        url.searchParams.set('release_type', 'ga');
        url.searchParams.set('vendor', 'eclipse');

        const payload = await fetchJson(url.toString(), {
            headers: {
                'User-Agent': MODRINTH_USER_AGENT
            }
        }).catch(() => []);

        const selected = Array.isArray(payload)
            ? payload.find((entry) => {
                const packageName = String(entry?.binary?.package?.name || '').toLowerCase();

                if (process.platform === 'win32') {
                    return packageName.endsWith('.zip');
                }

                return packageName.endsWith('.tar.gz') || packageName.endsWith('.tgz');
            }) || payload[0]
            : null;
        const binaryPackage = selected?.binary?.package;

        if (binaryPackage?.link && binaryPackage?.name) {
            return {
                url: binaryPackage.link,
                name: binaryPackage.name,
                size: Number(binaryPackage.size || 0),
                checksum: binaryPackage.checksum || '',
                releaseName: selected?.release_name || `Temurin ${majorVersion}`,
                imageType
            };
        }
    }

    throw new Error(`Не удалось найти Java ${majorVersion} для ${process.platform}/${normalizeJavaArchitecture(targetArch) || targetArch}.`);
}

async function ensureManagedJavaRuntime(majorVersion, onStatus, targetArch = process.arch) {
    ensureLauncherDataRoot();
    const normalizedTargetArch = normalizeJavaArchitecture(targetArch) || targetArch || process.arch;

    const cachedManifest = readManagedJavaManifest(majorVersion, normalizedTargetArch);
    if (cachedManifest) {
        return cachedManifest;
    }

    const runtimeDir = getManagedJavaRuntimeDir(majorVersion, normalizedTargetArch);
    const downloadDir = path.join(runtimeDir, 'downloads');
    const extractDir = path.join(runtimeDir, 'runtime');
    fs.mkdirSync(downloadDir, { recursive: true });

    const runtimePackage = await fetchManagedJavaPackage(majorVersion, normalizedTargetArch);
    const archivePath = path.join(downloadDir, runtimePackage.name);

    onStatus?.({
        stage: 'java',
        status: 'running',
        title: 'Подготовка Java',
        detail: `Java ${majorVersion} • ${runtimePackage.releaseName} • ${normalizedTargetArch}`,
        progress: 3
    });

    await downloadArtifactIfNeeded({
        url: runtimePackage.url,
        size: runtimePackage.size
    }, archivePath, ({ downloadedBytes, totalBytes, speedBytes }) => {
        onStatus?.({
            stage: 'java',
            status: 'running',
            title: 'Скачивание Java',
            detail: `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes || downloadedBytes)}`,
            speedBytes,
            progress: totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 8
        });
    });

    if (!verifyFileChecksum(archivePath, runtimePackage.checksum)) {
        fs.rmSync(archivePath, { force: true });
        throw new Error(`Контрольная сумма Java ${majorVersion} не совпала. Попробуйте ещё раз.`);
    }

    onStatus?.({
        stage: 'java',
        status: 'running',
        title: 'Распаковка Java',
        detail: runtimePackage.name,
        progress: 92
    });

    await extractArchive(archivePath, extractDir);
    const javaPath = findJavaExecutableInDirectory(extractDir);

    if (!javaPath) {
        throw new Error(`Java ${majorVersion} скачалась, но bin/java не найден.`);
    }

    if (process.platform !== 'win32') {
        try {
            fs.chmodSync(javaPath, 0o755);
        } catch {
            // Ignore chmod errors for managed runtimes on platforms that do not need it.
        }
    }

    const manifest = {
        id: getManagedJavaRuntimeId(majorVersion, normalizedTargetArch),
        targetArch: normalizedTargetArch,
        majorVersion: Number(majorVersion),
        javaPath,
        archiveName: runtimePackage.name,
        releaseName: runtimePackage.releaseName,
        platform: process.platform,
        arch: normalizedTargetArch,
        installedAt: new Date().toISOString()
    };

    fs.writeFileSync(getManagedJavaManifestPath(majorVersion, normalizedTargetArch), JSON.stringify(manifest, null, 2));
    emitJavaOptionsUpdate();
    return manifest;
}

async function resolveJavaRuntimeForBuild(build, settings, onStatus, versionMeta = null) {
    if (settings?.javaPath && settings.javaPath !== 'auto' && fs.existsSync(settings.javaPath)) {
        return {
            javaExecutable: settings.javaPath,
            source: 'manual',
            majorVersion: getRequiredJavaMajor(build, versionMeta)
        };
    }

    const requiredMajor = getRequiredJavaMajor(build, versionMeta);
    const localCandidate = getJavaCandidates(requiredMajor).find((candidate) => {
        return candidate.compatible && candidate.majorVersion === requiredMajor;
    });

    if (localCandidate) {
        onStatus?.({
            stage: 'java',
            status: 'running',
            title: 'Проверка Java',
            detail: `Найдена локальная Java ${requiredMajor}`,
            progress: 100
        });

        return {
            javaExecutable: localCandidate.value,
            source: localCandidate.source || 'local',
            majorVersion: requiredMajor
        };
    }

    const managed = await ensureManagedJavaRuntime(requiredMajor, onStatus);
    return {
        javaExecutable: managed.javaPath,
        source: 'managed',
        majorVersion: requiredMajor
    };
}

function getGitHubHeaders(token = '') {
    const headers = {
        'Accept': 'application/vnd.github+json',
        'User-Agent': MODRINTH_USER_AGENT
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

function decodeBase64Json(content = '') {
    const normalized = String(content || '').replace(/\s+/g, '');
    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf-8'));
}

function compareVersions(left = '0.0.0', right = '0.0.0') {
    const leftParts = String(left).split(/[^0-9]+/).filter(Boolean).map(Number);
    const rightParts = String(right).split(/[^0-9]+/).filter(Boolean).map(Number);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index += 1) {
        const leftValue = leftParts[index] || 0;
        const rightValue = rightParts[index] || 0;

        if (leftValue > rightValue) {
            return 1;
        }

        if (leftValue < rightValue) {
            return -1;
        }
    }

    return 0;
}

async function fetchRemoteLauncherManifest(token = '') {
    if (!String(token || '').trim()) {
        throw new Error('Добавьте GitHub token для доступа к приватному репозиторию.');
    }

    const payload = await fetchJson(GITHUB_PACKAGE_CONTENTS_URL, {
        headers: getGitHubHeaders(String(token).trim())
    });

    if (!payload?.content) {
        throw new Error('Не удалось получить package.json из GitHub.');
    }

    return decodeBase64Json(payload.content);
}

function getLauncherVersion() {
    return app.getVersion?.() || '2.0';
}

async function checkLauncherUpdates(token = '') {
    const currentVersion = getLauncherVersion();
    const remoteManifest = await fetchRemoteLauncherManifest(token);
    const remoteVersion = String(remoteManifest.version || '').trim() || currentVersion;
    const updateAvailable = compareVersions(remoteVersion, currentVersion) > 0;

    return {
        currentVersion,
        remoteVersion,
        updateAvailable,
        repository: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`,
        branch: GITHUB_BRANCH
    };
}

function copyDirectoryContents(sourceDir, destinationDir, excludedNames = new Set()) {
    fs.mkdirSync(destinationDir, { recursive: true });

    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        if (excludedNames.has(entry.name)) {
            continue;
        }

        const sourcePath = path.join(sourceDir, entry.name);
        const destinationPath = path.join(destinationDir, entry.name);

        if (entry.isDirectory()) {
            copyDirectoryContents(sourcePath, destinationPath, excludedNames);
            continue;
        }

        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.copyFileSync(sourcePath, destinationPath);
    }
}

async function applyLauncherUpdate(token = '') {
    if (activeGameProcess) {
        throw new Error('Нельзя обновить лаунчер, пока игра запущена.');
    }

    const updateState = await checkLauncherUpdates(token);
    if (!updateState.updateAvailable) {
        return {
            ...updateState,
            updated: false
        };
    }

    const tempRoot = path.join(os.tmpdir(), 'krakvamcl-update');
    const archivePath = path.join(tempRoot, 'update.zip');
    const extractDir = path.join(tempRoot, 'extract');

    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.mkdirSync(tempRoot, { recursive: true });

    await streamDownloadFile(GITHUB_ZIPBALL_URL, archivePath, null, {
        headers: getGitHubHeaders(String(token).trim())
    });
    await extractZip(archivePath, { dir: extractDir });

    const extractedRoot = fs.readdirSync(extractDir, { withFileTypes: true })
        .find((entry) => entry.isDirectory());

    if (!extractedRoot) {
        throw new Error('Не удалось распаковать обновление из GitHub.');
    }

    copyDirectoryContents(path.join(extractDir, extractedRoot.name), __dirname, new Set([
        '.git',
        '.github',
        'node_modules',
        'builds',
        'settings.json'
    ]));

    setTimeout(() => {
        app.relaunch();
        app.exit(0);
    }, 120);

    return {
        ...updateState,
        updated: true,
        relaunching: true
    };
}

async function getModrinthCategories(contentType = 'mods') {
    const typeInfo = CONTENT_TYPE_MAP[contentType] || CONTENT_TYPE_MAP.mods;
    const payload = await fetchJson(`${MODRINTH_API_BASE}/tag/category`, {
        headers: { 'User-Agent': MODRINTH_USER_AGENT }
    });

    const baseFilters = [{ value: 'all', label: 'All' }];
    const categories = (payload || [])
        .filter((item) => item.project_type === typeInfo.projectType)
        .map((item) => ({ value: item.name, label: item.name, header: item.header || '' }));

    const seen = new Set();
    return [...baseFilters, ...categories].filter((item) => {
        if (seen.has(item.value)) return false;
        seen.add(item.value);
        return true;
    });
}

async function getBuildOptions() {
    const [gameVersionsPayload, loadersPayload] = await Promise.all([
        fetchJson(`${MODRINTH_API_BASE}/tag/game_version`, {
            headers: {
                'User-Agent': MODRINTH_USER_AGENT
            }
        }),
        fetchJson(`${MODRINTH_API_BASE}/tag/loader`, {
            headers: {
                'User-Agent': MODRINTH_USER_AGENT
            }
        })
    ]);

    const gameVersions = (gameVersionsPayload || [])
        .filter((item) => item.version_type === 'release')
        .map((item) => item.version)
        .filter(Boolean)
        .filter((version) => version.localeCompare('1.7.10', undefined, { numeric: true }) >= 0)
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    const loaders = (loadersPayload || [])
        .map((item) => item.name)
        .filter((name) => ALLOWED_BUILD_LOADERS.includes(name));

    return {
        gameVersions: Array.from(new Set([DEFAULT_GAME_VERSION, ...gameVersions])),
        loaders: ALLOWED_BUILD_LOADERS.filter((name) => name === 'vanilla' || loaders.includes(name))
    };
}

async function searchModrinthMods(query, gameVersion = DEFAULT_GAME_VERSION, loader = DEFAULT_LOADER, category = 'all', limit = 12, offset = 0, contentType = 'mods') {
    const typeInfo = CONTENT_TYPE_MAP[contentType] || CONTENT_TYPE_MAP.mods;

    const facets = [
        [`project_type:${typeInfo.projectType}`],
        [`versions:${gameVersion}`]
    ];

    // Для модов добавляем загрузчик, для остальных — нет
    if (typeInfo.useLoader && loader && loader !== 'vanilla') {
        facets.push([`categories:${loader}`]);
    }

    if (category && category !== 'all') {
        facets.push([`categories:${category}`]);
    }

    const url = new URL(`${MODRINTH_API_BASE}/search`);
    if (query) url.searchParams.set('query', query);
    url.searchParams.set('limit', String(Math.max(1, Number(limit) || 12)));
    url.searchParams.set('offset', String(Math.max(0, Number(offset) || 0)));
    url.searchParams.set('index', query ? 'relevance' : 'downloads');
    url.searchParams.set('facets', JSON.stringify(facets));

    const payload = await fetchJson(url, { headers: { 'User-Agent': MODRINTH_USER_AGENT } });

    return {
        total: Number(payload.total_hits || payload.total || 0),
        items: (payload.hits || []).map((item) => ({
            id: item.project_id,
            title: item.title,
            author: item.author || 'Unknown',
            summary: item.description || '',
            downloads: item.downloads || 0,
            iconUrl: item.icon_url || item.featured_gallery || item.gallery?.[0] || '',
            categories: item.display_categories || item.categories || [],
            versions: item.versions || [],
            contentType,
            raw: item
        }))
    };
}

async function getModrinthDownload(projectId, gameVersion = DEFAULT_GAME_VERSION, loader = DEFAULT_LOADER, contentType = 'mods') {
    const typeInfo = CONTENT_TYPE_MAP[contentType] || CONTENT_TYPE_MAP.mods;
    const url = new URL(`${MODRINTH_API_BASE}/project/${projectId}/version`);

    if (typeInfo.useLoader && loader && loader !== 'vanilla') {
        url.searchParams.set('loaders', JSON.stringify([loader]));
    }
    url.searchParams.set('game_versions', JSON.stringify([gameVersion]));
    url.searchParams.set('include_changelog', 'false');

    const versions = await fetchJson(url, { headers: { 'User-Agent': MODRINTH_USER_AGENT } });
    const version = versions.find((item) => Array.isArray(item.files) && item.files.length > 0)
        || versions[0];

    if (!version) {
        throw new Error('Не удалось подобрать совместимую версию Modrinth.');
    }

    const file = version.files.find((entry) => entry.primary) || version.files[0];

    return {
        url: file.url,
        filename: file.filename,
        versionName: version.version_number || version.name,
        version,
        subdir: typeInfo.subdir
    };
}

async function getProjectDetails(projectId) {
    return fetchJson(`${MODRINTH_API_BASE}/project/${projectId}`, {
        headers: {
            'User-Agent': MODRINTH_USER_AGENT
        }
    });
}

async function resolveRequiredDependencies(version, gameVersion = DEFAULT_GAME_VERSION, loader = DEFAULT_LOADER) {
    const required = (version?.dependencies || [])
        .filter((dependency) => dependency.dependency_type === 'required' && dependency.project_id)
        .map((dependency) => dependency.project_id);

    const uniqueProjectIds = Array.from(new Set(required));
    const projects = await Promise.all(uniqueProjectIds.map(async (projectId) => {
        try {
            const project = await getProjectDetails(projectId);
            return {
                projectId,
                title: project.title || project.slug || projectId,
                author: project.author || '',
                slug: project.slug || ''
            };
        } catch {
            return {
                projectId,
                title: projectId,
                author: '',
                slug: ''
            };
        }
    }));

    const versions = await Promise.all(projects.map(async (project) => {
        try {
            const resolved = await getModrinthDownload(project.projectId, gameVersion, loader);
            return {
                ...project,
                filename: resolved.filename,
                url: resolved.url,
                versionName: resolved.versionName
            };
        } catch {
            return {
                ...project,
                filename: '',
                url: '',
                versionName: ''
            };
        }
    }));

    return versions.filter((entry) => entry.url && entry.filename);
}

async function downloadFile(destinationDir, url, filename) {
    fs.mkdirSync(destinationDir, { recursive: true });

    const safeFilename = filename || `mod-${Date.now()}.jar`;
    const destination = path.join(destinationDir, safeFilename);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Не удалось скачать файл: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.promises.writeFile(destination, Buffer.from(arrayBuffer));

    return destination;
}

function isDisabledContentName(name = '') {
    return /\.disabled$/i.test(String(name || ''));
}

function getContentBaseName(name = '') {
    return String(name || '').replace(/\.disabled$/i, '');
}

function getInstalledEntryDisplayTitle(filename = '', contentType = 'mods') {
    const basename = getContentBaseName(filename);
    if (contentType === 'mods') {
        return inferModTitle(basename);
    }

    return String(basename)
        .replace(/\.(zip|mrpack)$/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function shouldIncludeInstalledEntry(entry, contentType = 'mods') {
    if (!entry || String(entry.name || '').startsWith('.')) {
        return false;
    }

    const normalizedName = getContentBaseName(entry.name);

    if (contentType === 'mods') {
        return entry.isDirectory() || (entry.isFile() && /\.jar$/i.test(normalizedName));
    }

    if (contentType === 'modpacks') {
        return entry.isDirectory() || /\.(mrpack|zip)$/i.test(normalizedName);
    }

    return entry.isDirectory() || /\.(zip|jar)$/i.test(normalizedName);
}

function listInstalledMods(buildId = null, contentType = 'all') {
    const activeBuild = buildId ? readBuild(buildId) : getActiveBuild();

    if (!activeBuild) {
        throw new Error('Сборка не найдена.');
    }

    const metadata = loadBuildModsMeta(activeBuild.id);
    const requestedTypes = contentType === 'all'
        ? INSTALLABLE_CONTENT_TYPES
        : [contentType];
    const files = requestedTypes.flatMap((type) => {
        const contentPath = getBuildContentPath(activeBuild.id, type);
        fs.mkdirSync(contentPath, { recursive: true });

        return fs.readdirSync(contentPath, { withFileTypes: true })
            .filter((entry) => shouldIncludeInstalledEntry(entry, type))
            .map((entry) => {
                const filename = entry.name;
                const enabled = !isDisabledContentName(filename);
                const meta = type === 'mods'
                    ? metadata[filename] || metadata[getContentBaseName(filename)] || null
                    : null;

                return {
                    id: `${type}:${filename}`,
                    filename,
                    projectId: meta?.projectId || null,
                    title: meta?.title || getInstalledEntryDisplayTitle(filename, type),
                    author: meta?.author || '',
                    versionName: meta?.versionName || '',
                    enabled,
                    path: path.join(contentPath, filename),
                    normalizedName: normalizeModKey(meta?.title || filename),
                    source: meta?.source || 'file',
                    installedAt: meta?.installedAt || '',
                    contentType: type,
                    isDirectory: entry.isDirectory()
                };
            });
    })
        .sort((a, b) => a.title.localeCompare(b.title, 'ru', { sensitivity: 'base' }));

    return {
        build: activeBuild,
        mods: files
    };
}

function updateInstalledModFilenameMeta(buildId, fromFilename, toFilename) {
    const metadata = loadBuildModsMeta(buildId);

    if (metadata[fromFilename]) {
        metadata[toFilename] = metadata[fromFilename];
        delete metadata[fromFilename];
        saveBuildModsMeta(buildId, metadata);
        return;
    }

    if (metadata[toFilename]) {
        return;
    }

    const baseFrom = fromFilename.replace(/\.disabled$/i, '');
    const baseTo = toFilename.replace(/\.disabled$/i, '');

    if (metadata[baseFrom]) {
        metadata[baseTo] = metadata[baseFrom];
        delete metadata[baseFrom];
        saveBuildModsMeta(buildId, metadata);
    }
}

function toggleInstalledMod(filename, buildId = null, contentType = 'mods') {
    const activeBuild = buildId ? readBuild(buildId) : getActiveBuild();

    if (!activeBuild) {
        throw new Error('Сборка не найдена.');
    }

    const contentPath = getBuildContentPath(activeBuild.id, contentType);
    fs.mkdirSync(contentPath, { recursive: true });
    const currentPath = path.join(contentPath, filename);
    if (!fs.existsSync(currentPath)) {
        throw new Error('Файл не найден.');
    }

    const nextFilename = filename.endsWith('.disabled')
        ? filename.replace(/\.disabled$/i, '')
        : `${filename}.disabled`;
    const nextPath = path.join(contentPath, nextFilename);

    fs.renameSync(currentPath, nextPath);
    if (contentType === 'mods') {
        updateInstalledModFilenameMeta(activeBuild.id, filename, nextFilename);
    }

    return listInstalledMods(activeBuild.id, 'all');
}

function deleteInstalledMod(filename, buildId = null, contentType = 'mods') {
    const activeBuild = buildId ? readBuild(buildId) : getActiveBuild();

    if (!activeBuild) {
        throw new Error('Сборка не найдена.');
    }

    const contentPath = getBuildContentPath(activeBuild.id, contentType);
    fs.mkdirSync(contentPath, { recursive: true });
    const targetPath = path.join(contentPath, filename);
    if (!fs.existsSync(targetPath)) {
        throw new Error('Файл не найден.');
    }

    fs.rmSync(targetPath, { recursive: true, force: true });

    if (contentType === 'mods') {
        const metadata = loadBuildModsMeta(activeBuild.id);
        delete metadata[filename];
        delete metadata[filename.replace(/\.disabled$/i, '')];
        saveBuildModsMeta(activeBuild.id, metadata);
    }

    return listInstalledMods(activeBuild.id, 'all');
}

function getActiveBuild() {
    const settings = loadSettings();
    return readBuild(settings.activeBuildId) || readBuild(DEFAULT_BUILD_ID);
}

function listBuildsState() {
    const settings = loadSettings();
    const builds = listBuilds();
    const activeBuildId = builds.some((build) => build.id === settings.activeBuildId) ? settings.activeBuildId : DEFAULT_BUILD_ID;

    if (activeBuildId !== settings.activeBuildId) {
        saveSettings({ ...settings, activeBuildId });
    }

    return {
        builds,
        activeBuildId
    };
}

function createBuild({ name, minecraftVersion, loader }) {
    ensureBuildsRoot();

    const normalizedName = String(name || '').trim();
    if (!normalizedName) {
        throw new Error('Введите название сборки.');
    }

    const baseId = buildDirNameFromName(normalizedName);
    let nextId = baseId;
    let index = 2;

    while (fs.existsSync(getBuildDir(nextId))) {
        nextId = `${baseId} ${index}`;
        index += 1;
    }

    const meta = {
        id: nextId,
        name: normalizedName,
        minecraftVersion: minecraftVersion || DEFAULT_GAME_VERSION,
        loader: ALLOWED_BUILD_LOADERS.includes(loader) ? loader : DEFAULT_LOADER,
        loaderVersion: '',
        runtimeVersionId: '',
        isDefault: false
    };

    fs.mkdirSync(getBuildDir(nextId), { recursive: true });
    fs.mkdirSync(getBuildModsPath(nextId), { recursive: true });
    fs.mkdirSync(getBuildLibrariesPath(nextId), { recursive: true });
    fs.mkdirSync(getBuildVersionsDir(nextId), { recursive: true });
    fs.mkdirSync(getBuildReportsDir(nextId), { recursive: true });
    fs.writeFileSync(getBuildMetaPath(nextId), JSON.stringify(meta, null, 2));

    const settings = loadSettings();
    saveSettings({ ...settings, activeBuildId: nextId });

    return readBuild(nextId);
}

function updateBuild(buildId, { name, minecraftVersion, loader }) {
    const current = readBuild(buildId);

    if (!current) {
        throw new Error('Сборка не найдена.');
    }

    const nextName = String(name || '').trim() || current.name;
    const nextVersion = minecraftVersion || current.minecraftVersion;
    const nextLoader = ALLOWED_BUILD_LOADERS.includes(loader) ? loader : current.loader;

    let nextId = buildId;
    const desiredId = buildDirNameFromName(nextName);

    if (desiredId !== buildId && desiredId) {
        nextId = desiredId;
        let index = 2;

        while (fs.existsSync(getBuildDir(nextId)) && nextId !== buildId) {
            nextId = `${desiredId} ${index}`;
            index += 1;
        }

        if (nextId !== buildId) {
            fs.renameSync(getBuildDir(buildId), getBuildDir(nextId));
        }
    }

    const nextMeta = {
        id: nextId,
        name: nextName,
        minecraftVersion: nextVersion,
        loader: nextLoader,
        loaderVersion: nextLoader === current.loader ? (current.loaderVersion || '') : '',
        runtimeVersionId: nextLoader === current.loader && nextVersion === current.minecraftVersion ? (current.runtimeVersionId || '') : '',
        isDefault: Boolean(current.isDefault)
    };

    fs.mkdirSync(getBuildModsPath(nextId), { recursive: true });
    fs.mkdirSync(getBuildLibrariesPath(nextId), { recursive: true });
    fs.mkdirSync(getBuildVersionsDir(nextId), { recursive: true });
    fs.mkdirSync(getBuildReportsDir(nextId), { recursive: true });
    fs.writeFileSync(getBuildMetaPath(nextId), JSON.stringify(nextMeta, null, 2));

    const settings = loadSettings();
    if (settings.activeBuildId === buildId) {
        saveSettings({ ...settings, activeBuildId: nextId });
    }

    return readBuild(nextId);
}

function deleteBuild(buildId) {
    const current = readBuild(buildId);

    if (!current) {
        throw new Error('Сборка не найдена.');
    }

    if (current.isDefault) {
        throw new Error('Стандартную сборку удалить нельзя.');
    }

    fs.rmSync(getBuildDir(buildId), { recursive: true, force: true });

    const settings = loadSettings();
    if (settings.activeBuildId === buildId) {
        saveSettings({ ...settings, activeBuildId: DEFAULT_BUILD_ID });
    }

    return true;
}

function setActiveBuild(buildId) {
    const build = readBuild(buildId);

    if (!build) {
        throw new Error('Сборка не найдена.');
    }

    const settings = loadSettings();
    saveSettings({ ...settings, activeBuildId: build.id });

    return build;
}

async function searchMods({ query, gameVersion = DEFAULT_GAME_VERSION, loader = DEFAULT_LOADER, category = 'all', page = 1, limit = 12, contentType = 'mods' }) {
    const safeLimit = Math.max(1, Number(limit) || 12);
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;
    return searchModrinthMods((query || '').trim(), gameVersion, loader, category, safeLimit, offset, contentType);
}

async function downloadMod({ modId, gameVersion = DEFAULT_GAME_VERSION, loader = DEFAULT_LOADER, title = '', author = '', contentType = 'mods' }) {
    const activeBuild = getActiveBuild();
    const resolved = await getModrinthDownload(modId, gameVersion, loader, contentType);

    // Определяем целевую папку в зависимости от типа контента
    const subdir = resolved.subdir || 'mods';
    const targetDir = path.join(getBuildDir(activeBuild.id), subdir);
    fs.mkdirSync(targetDir, { recursive: true });

    const destination = await downloadFile(targetDir, resolved.url, resolved.filename);
    const basename = path.basename(destination);

    // Мета сохраняется только для модов (остальные не имеют projectId в mods-meta)
    if (contentType === 'mods') {
        setBuildModMeta(activeBuild.id, basename, {
            projectId: modId,
            title: title || inferModTitle(resolved.filename),
            author: author || '',
            versionName: resolved.versionName || '',
            source: 'modrinth',
            installedAt: new Date().toISOString()
        });
    }

    const installedModsState = contentType === 'mods' ? listInstalledMods(activeBuild.id) : { mods: [] };

    // Зависимости только для модов
    let missingDependencies = [];
    if (contentType === 'mods') {
        const installedKeys = new Set(installedModsState.mods.flatMap((mod) => [
            mod.projectId ? String(mod.projectId) : '',
            mod.normalizedName || ''
        ]).filter(Boolean));
        const dependencies = await resolveRequiredDependencies(resolved.version, gameVersion, loader);
        missingDependencies = dependencies.filter((dependency) => {
            const dependencyKey = normalizeModKey(dependency.title || dependency.filename || dependency.projectId);
            return !installedKeys.has(String(dependency.projectId)) && !installedKeys.has(dependencyKey);
        });
    }

    return {
        filePath: destination,
        filename: basename,
        folder: targetDir,
        versionName: resolved.versionName,
        contentType,
        installedMods: installedModsState,
        missingDependencies
    };
}

async function installDependencies({ dependencies = [], buildId = null }) {
    const activeBuild = buildId ? readBuild(buildId) : getActiveBuild();

    if (!activeBuild) {
        throw new Error('Сборка не найдена.');
    }

    for (const dependency of dependencies) {
        const destination = await downloadFile(activeBuild.modsPath, dependency.url, dependency.filename);
        setBuildModMeta(activeBuild.id, path.basename(destination), {
            projectId: dependency.projectId,
            title: dependency.title || inferModTitle(dependency.filename),
            author: dependency.author || '',
            versionName: dependency.versionName || '',
            source: 'dependency',
            installedAt: new Date().toISOString()
        });
    }

    return listInstalledMods(activeBuild.id);
}

function createWindow() {
    let iconPath;
    if (process.platform === 'win32') {
        iconPath = path.join(__dirname, 'assets', 'icon.ico');
    } else if (process.platform === 'darwin') {
        iconPath = path.join(__dirname, 'assets', 'icon.icns');
    } else {
        iconPath = path.join(__dirname, 'assets', 'icon.png');
    }

    mainWindow = new BrowserWindow({
        width: 650,
        height: 450,
        minWidth: 650,
        minHeight: 450,
        transparent: true,
        frame: false,
        center: true,
        icon: iconPath,
        title: 'KrakvaMCL',
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
        backgroundColor: '#00000000',
        show: false,
        resizable: false,
        fullscreenable: false,
        maximizable: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            backgroundThrottling: false
        }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, 'splash.html'));

    // did-finish-load срабатывает когда DOM готов и JS выполнен.
    // Ждём два requestAnimationFrame — за это время Chromium успевает
    // скомпоновать GPU-текстуру с начальным состоянием CSS.
    // Без этого на Windows 11 с transparent:true окно показывается до
    // первого paint и splash выглядит пустым/прозрачным.
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(
            'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'
        ).then(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.show();
            }
        }).catch(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.show();
            }
        });
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function applyMacAppIcon() {
    if (process.platform !== 'darwin' || !app.dock) {
        return;
    }

    const dockIconPath = path.join(__dirname, 'assets', 'icon.icns');
    if (!fs.existsSync(dockIconPath)) {
        return;
    }

    const iconImage = nativeImage.createFromPath(dockIconPath);
    if (iconImage.isEmpty()) {
        return;
    }

    app.dock.setIcon(iconImage);
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    migrateLegacyData();
    ensureDefaultBuild();
    ensureDiscordRpc();
    applyMacAppIcon();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.on('window:minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    if (window) {
        window.minimize();
    }
});

ipcMain.on('window:close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    if (window) {
        window.close();
    }
});

ipcMain.handle('settings:load', () => {
    return loadSettings();
});

ipcMain.handle('settings:save', (_event, settings) => {
    // Clear related caches when settings change
    cache.builds.data = null;
    cache.builds.timestamp = 0;
    return saveSettings(settings);
});

ipcMain.handle('system:info', () => {
    // Cache system info for 1 minute as it doesn't change often
    if (!cache.systemInfo) {
        cache.systemInfo = { data: null, timestamp: 0, ttl: 60000 };
    }
    
    const now = Date.now();
    if (cache.systemInfo.data && now - cache.systemInfo.timestamp < cache.systemInfo.ttl) {
        return cache.systemInfo.data;
    }
    
    const cachedJava = readJavaCandidatesCache();
    const canFastPath = process.platform === 'win32' && cachedJava?.javaOptions?.length;
    const javaOptions = canFastPath
        ? cachedJava.javaOptions
        : [{ value: 'auto', label: 'AutoJava' }, ...getJavaCandidates()];
    const result = {
        ...getSystemInfo(),
        javaOptions
    };
    cache.systemInfo.data = result;
    cache.systemInfo.timestamp = now;

    if (canFastPath && !cachedJava.isFresh) {
        setTimeout(() => {
            emitJavaOptionsUpdate();
        }, 0);
    } else if (!canFastPath) {
        writeJavaCandidatesCache(javaOptions);
    }

    return result;
});

ipcMain.handle('java:select', async () => {
    const result = await dialog.showOpenDialog({
        title: 'Выберите Java',
        properties: ['openFile'],
        filters: [
            {
                name: 'Java',
                extensions: process.platform === 'win32' ? ['exe'] : ['*']
            }
        ]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    return result.filePaths[0];
});

ipcMain.handle('mods:search', async (_event, payload) => {
    const cacheKey = `modsSearch_${JSON.stringify(payload)}`;
    let cached = cache.modsSearch.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) {
        return cached.data;
    }
    const result = await searchMods(payload || {});
    cache.modsSearch.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
});

ipcMain.handle('mods:download', async (_event, payload) => {
    return downloadMod(payload || {});
});

ipcMain.handle('mods:list-installed', (_event, buildId) => {
    const normalizedBuildId = typeof buildId === 'object' && buildId !== null ? buildId.buildId || null : buildId;
    const contentType = typeof buildId === 'object' && buildId !== null ? buildId.contentType || 'all' : 'all';
    const cacheKey = `installedMods_${normalizedBuildId}_${contentType}`;
    let cached = cache.installedMods.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 10000) {
        return cached.data;
    }
    const result = listInstalledMods(normalizedBuildId || null, contentType);
    cache.installedMods.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
});

ipcMain.handle('mods:toggle-installed', (_event, payload) => {
    const buildCacheKey = payload?.buildId || null;
    const result = toggleInstalledMod(payload?.filename, buildCacheKey, payload?.contentType || 'mods');
    for (const key of cache.installedMods.keys()) {
        if (key.startsWith(`installedMods_${buildCacheKey}_`)) {
            cache.installedMods.delete(key);
        }
    }
    return result;
});

ipcMain.handle('mods:delete-installed', (_event, payload) => {
    const buildCacheKey = payload?.buildId || null;
    const result = deleteInstalledMod(payload?.filename, buildCacheKey, payload?.contentType || 'mods');
    for (const key of cache.installedMods.keys()) {
        if (key.startsWith(`installedMods_${buildCacheKey}_`)) {
            cache.installedMods.delete(key);
        }
    }
    return result;
});

ipcMain.handle('mods:install-dependencies', async (_event, payload) => {
    return installDependencies(payload || {});
});

ipcMain.handle('mods:open-report', async (_event, filePath) => {
    return openCrashReport(filePath || '');
});

ipcMain.handle('mods:state', () => {
    const activeBuild = getActiveBuild();
    return {
        folder: activeBuild.modsPath,
        activeBuild
    };
});

ipcMain.handle('mods:filters', async (_event, payload) => {
    const contentType = payload?.contentType || 'mods';
    const cacheKey = `modsFilters_${contentType}`;
    if (!cache[cacheKey]) cache[cacheKey] = { data: null, timestamp: 0, ttl: 60000 };
    const cached = getFromCache(cacheKey);
    if (cached) return cached;
    const result = await getModrinthCategories(contentType);
    setInCache(cacheKey, result, 60000);
    return result;
});

ipcMain.handle('mods:open-folder', async (_event, payload) => {
    const activeBuild = getActiveBuild();
    const contentType = payload?.contentType || 'mods';
    const targetPath = contentType === 'all'
        ? activeBuild.path
        : getBuildContentPath(activeBuild.id, contentType);
    fs.mkdirSync(targetPath, { recursive: true });
    const result = await shell.openPath(targetPath);

    if (result) {
        throw new Error(result);
    }

    return targetPath;
});

ipcMain.handle('builds:list', () => {
    const cached = getFromCache('builds');
    if (cached) {
        return cached;
    }
    const result = listBuildsState();
    setInCache('builds', result);
    return result;
});

ipcMain.handle('cache:load', (_event, key) => {
    if (key !== 'app-cache') {
        return null;
    }

    return readAppCache();
});

ipcMain.handle('cache:save', (_event, payload) => {
    if (payload?.key !== 'app-cache') {
        return false;
    }

    return writeAppCache(payload.value);
});

ipcMain.handle('builds:options', async () => {
    const cached = getFromCache('buildOptions');
    if (cached) {
        return cached;
    }
    try {
        const result = await getBuildOptions();
        setInCache('buildOptions', result);
        return result;
    } catch {
        const fallback = {
            gameVersions: [
                DEFAULT_GAME_VERSION,
                '1.21.10',
                '1.21.8',
                '1.20.1',
                '1.19.4',
                '1.18.2',
                '1.17.1',
                '1.16.5',
                '1.12.2',
                '1.8.9',
                '1.7.10'
            ],
            loaders: ALLOWED_BUILD_LOADERS
        };
        setInCache('buildOptions', fallback);
        return fallback;
    }
});

ipcMain.handle('builds:create', (_event, payload) => {
    const result = createBuild(payload || {});
    // Invalidate builds cache
    cache.builds.data = null;
    cache.builds.timestamp = 0;
    return result;
});

ipcMain.handle('builds:update', (_event, payload) => {
    const result = updateBuild(payload?.id, payload || {});
    // Invalidate builds cache
    cache.builds.data = null;
    cache.builds.timestamp = 0;
    return result;
});

ipcMain.handle('builds:delete', (_event, buildId) => {
    return deleteBuild(buildId);
});

ipcMain.handle('builds:set-active', (_event, buildId) => {
    return setActiveBuild(buildId);
});

ipcMain.handle('builds:open-folder', async (_event, buildId) => {
    const build = buildId ? readBuild(buildId) : getActiveBuild();

    if (!build) {
        throw new Error('Сборка не найдена.');
    }

    const result = await shell.openPath(build.path);

    if (result) {
        throw new Error(result);
    }

    return build.path;
});

ipcMain.handle('builds:export', async (_event, buildId) => {
    return exportBuildToFile(buildId);
});

ipcMain.handle('builds:import-json', async (_event, payload) => {
    if (payload?.jsonText) {
        return importBuildFromJsonInput(payload.jsonText);
    }

    return importBuildFromFile();
});

ipcMain.handle('builds:import-configs', async (_event, buildId) => {
    return importBuildConfigs(buildId);
});

ipcMain.handle('game:download-version', async (_event, buildId) => {
    return downloadVersionForBuild(buildId || null);
});

ipcMain.handle('game:launch', async (_event, payload) => {
    return launchGame(payload || null);
});

ipcMain.handle('game:state', () => {
    return getGameState();
});

ipcMain.handle('presence:update', (_event, payload) => {
    const build = payload?.build && typeof payload.build === 'object' ? payload.build : null;
    updateDiscordPresence({
        activeView: payload?.activeView || discordPresenceState.activeView,
        gameVersion: build?.minecraftVersion || discordPresenceState.gameVersion,
        buildName: build?.name || build?.id || discordPresenceState.buildName,
        launchTitle: payload?.launchTitle || discordPresenceState.launchTitle,
        launchDetail: payload?.launchDetail || discordPresenceState.launchDetail
    });
    return true;
});

ipcMain.handle('launcher-updates:check', async (_event, payload) => {
    return checkLauncherUpdates(payload?.token || loadSettings().githubToken || '');
});

ipcMain.handle('launcher-updates:apply', async (_event, payload) => {
    return applyLauncherUpdate(payload?.token || loadSettings().githubToken || '');
});
