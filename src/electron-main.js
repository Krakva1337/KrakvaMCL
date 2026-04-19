const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const extractZip = require('extract-zip');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MODRINTH_API_BASE = 'https://api.modrinth.com/v2';
const MODRINTH_USER_AGENT = 'KrakvaMCL/0.1.0 (desktop launcher)';
const FABRIC_META_BASE = 'https://meta.fabricmc.net/v2';
const DEFAULT_GAME_VERSION = '1.21.11';
const DEFAULT_LOADER = 'vanilla';
const DEFAULT_BUILD_ID = 'Standart';
const ALLOWED_BUILD_LOADERS = ['vanilla', 'forge', 'fabric', 'neoforge', 'optifine'];
const MOJANG_VERSION_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const BUILD_CONFIG_IMPORT_FILES = ['options.txt', 'servers.dat'];
const BUILD_CONFIG_IMPORT_DIRS = ['config', 'resourcepacks', 'shaderpacks', 'optionsof', 'screenshots'];
const GITHUB_OWNER = 'Krakva1337';
const GITHUB_REPO = 'KrakvaMCL';
const GITHUB_BRANCH = 'main';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
const GITHUB_PACKAGE_CONTENTS_URL = `${GITHUB_API_BASE}/contents/package.json?ref=${GITHUB_BRANCH}`;
const GITHUB_ZIPBALL_URL = `${GITHUB_API_BASE}/zipball/${GITHUB_BRANCH}`;

let mainWindow = null;
let activeGameProcess = null;
let latestCrashReportPath = '';
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
const logConfigsRoot = path.join(launcherDataRoot, 'log-configs');
const reportsRoot = path.join(launcherDataRoot, 'crash-reports');
const bundledKrakvaAgentPath = path.join(__dirname, 'assets', 'KrakvaAgent-runtime.jar');

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
    fs.mkdirSync(logConfigsRoot, { recursive: true });
    fs.mkdirSync(reportsRoot, { recursive: true });
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
        githubToken: ''
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

function getBuildDir(buildId) {
    return path.join(buildsRoot, buildId);
}

function getBuildMetaPath(buildId) {
    return path.join(getBuildDir(buildId), 'build.json');
}

function getBuildModsPath(buildId) {
    return path.join(getBuildDir(buildId), 'mods');
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
        isDefault: true
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

    const [group, artifact, version, classifier] = String(library.name || '').split(':');
    if (!group || !artifact || !version) {
        return null;
    }

    const filename = classifier ? `${artifact}-${version}-${classifier}.jar` : `${artifact}-${version}.jar`;
    return path.join(group.replaceAll('.', '/'), artifact, version, filename);
}

function getLibraryArtifactDownload(library = {}) {
    if (library?.downloads?.artifact?.url) {
        return library.downloads.artifact;
    }

    const artifactPath = getLibraryArtifactPath(library);
    if (!artifactPath || !library?.url) {
        return null;
    }

    return {
        path: artifactPath,
        url: `${String(library.url).replace(/\/+$/, '')}/${artifactPath.replaceAll(path.sep, '/')}`,
        size: 0
    };
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

async function ensureLibraries(versionMeta, onProgress) {
    const features = {};
    const libraries = [];
    const nativeEntries = [];
    const seenClassPathEntries = new Set();
    let completed = 0;
    const activeLibraries = (versionMeta.libraries || []).filter((library) => isAllowedByRules(library.rules, features));

    for (const library of activeLibraries) {
        const artifactDownload = getLibraryArtifactDownload(library);
        const artifactPath = artifactDownload?.path || getLibraryArtifactPath(library);
        if (artifactDownload?.url && artifactPath) {
            const destination = path.join(librariesRoot, artifactPath);
            await downloadArtifactIfNeeded(artifactDownload, destination);
            if (!seenClassPathEntries.has(destination)) {
                libraries.push(destination);
                seenClassPathEntries.add(destination);
            }
        }

        const nativeClassifier = resolveNativeClassifier(library);
        if (nativeClassifier && library?.downloads?.classifiers?.[nativeClassifier]) {
            const classifierDownload = library.downloads.classifiers[nativeClassifier];
            const destination = path.join(librariesRoot, classifierDownload.path);
            await downloadArtifactIfNeeded(classifierDownload, destination);
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
        krakvaAgentPath
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
        krakvaAgentPath
    };
}

function buildLaunchArguments({ runtime, build, javaExecutable, settings, accountName }) {
    const versionMeta = runtime.versionMeta;
    if (!versionMeta?.mainClass) {
        throw new Error('В version json отсутствует mainClass для запуска клиента.');
    }

    const username = String(accountName || 'Player').trim() || 'Player';
    const uuid = createOfflineUuid(username);
    const gameDir = getBuildGameDir(build.id);
    const classpath = [...runtime.libraries, runtime.clientJarPath].join(path.delimiter);
    const replacements = {
        auth_player_name: username,
        version_name: runtime.versionId,
        game_directory: gameDir,
        assets_root: assetsRoot,
        assets_index_name: versionMeta.assetIndex?.id || runtime.assetIndexData?.id || runtime.versionId,
        auth_uuid: uuid,
        auth_access_token: 'offline-access-token',
        clientid: 'offline-client',
        auth_xuid: '0',
        user_type: 'legacy',
        version_type: versionMeta.type || 'release',
        user_properties: '{}',
        natives_directory: runtime.nativesDir,
        launcher_name: 'KrakvaMCL',
        launcher_version: app.getVersion?.() || '0.1.0',
        classpath,
        classpath_separator: path.delimiter,
        library_directory: librariesRoot,
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

    if (runtime.krakvaAgentPath && !jvmArguments.some((argument) => String(argument).startsWith('-javaagent:'))) {
        jvmArguments.push(`-javaagent:${runtime.krakvaAgentPath}`);
    }

    if (!hasClasspath) {
        jvmArguments.push('-cp', classpath);
    }

    const gameArguments = versionMeta.arguments?.game?.length
        ? resolveArgumentList(versionMeta.arguments.game, replacements, features)
        : parseLegacyArguments(versionMeta.minecraftArguments).map((value) => interpolateValue(value, replacements));

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

async function downloadVersionForBuild(buildId = null) {
    const build = buildId ? readBuild(buildId) : getActiveBuild();

    if (!build) {
        throw new Error('Сборка не найдена.');
    }

    const loader = String(build.loader || '').toLowerCase();
    if (!['vanilla', 'fabric'].includes(loader)) {
        throw new Error(`Реальный runtime пока поддержан только для vanilla и fabric. Loader "${build.loader}" ещё не реализован.`);
    }

    emitGameStatus({
        stage: 'download',
        status: 'preparing',
        title: 'Подготовка версии',
        detail: `${build.minecraftVersion} • ${build.loader}`,
        progress: 0
    });

    const result = loader === 'fabric'
        ? await prepareFabricRuntime(build, 'Player', (payload) => emitGameStatus(payload))
        : await prepareVanillaRuntime(build, 'Player', (payload) => emitGameStatus(payload));

    emitGameStatus({
        stage: 'download',
        status: 'completed',
        title: 'Версия готова',
        detail: `${build.minecraftVersion} runtime готов`,
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
    if (!['vanilla', 'fabric'].includes(loader)) {
        throw new Error(`Loader "${build.loader}" пока не поддержан для runtime-запуска. Сейчас полноценно работают vanilla и fabric.`);
    }

    const settings = loadSettings();
    const javaExecutable = resolveJavaExecutable(settings.javaPath);
    const accountName = String(normalizedPayload.accountName || '').trim() || 'Player';
    const runtime = loader === 'fabric'
        ? await prepareFabricRuntime(build, accountName, (statusPayload) => emitGameStatus(statusPayload))
        : await prepareVanillaRuntime(build, accountName, (statusPayload) => emitGameStatus(statusPayload));
    const launchState = buildLaunchArguments({
        runtime,
        build,
        javaExecutable,
        settings,
        accountName
    });
    const command = launchState.command;
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
        command: launchState.commandLine,
        progress: 100
    });

    const stdoutChunks = [];
    const stderrChunks = [];
    activeGameProcess = spawn(javaExecutable, command, {
        cwd: getBuildGameDir(build.id),
        stdio: ['ignore', 'pipe', 'pipe']
    });

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
    });

    activeGameProcess.on('error', async (error) => {
        clearTimeout(hideTimer);
        activeGameProcess = null;
        const report = createCrashReport({
            build,
            command: [javaExecutable, ...command],
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
        } else {
            const report = createCrashReport({
                build,
                command: [javaExecutable, ...command],
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
        }

        if (settings.reopenLauncherOnGameExit && mainWindow && !mainWindow.isDestroyed()) {
            await showLauncherWindowAnimated();
        }
    });

    return {
        pid: activeGameProcess.pid,
        build,
        jarPath: runtime.clientJarPath,
        command: [javaExecutable, ...command]
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
    fs.mkdirSync(getBuildVersionsDir(buildId), { recursive: true });
    fs.mkdirSync(getBuildReportsDir(buildId), { recursive: true });

    const buildPath = getBuildDir(buildId);

    return {
        id: buildId,
        name: meta.name || buildId,
        minecraftVersion: meta.minecraftVersion || DEFAULT_GAME_VERSION,
        loader: meta.loader || DEFAULT_LOADER,
        isDefault: Boolean(meta.isDefault),
        path: buildPath,
        modsPath: getBuildModsPath(buildId),
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

function getJavaCandidates() {
    const candidates = new Set();
    const envCandidates = [
        process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : null,
        process.env.JDK_HOME ? path.join(process.env.JDK_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : null
    ].filter(Boolean);

    envCandidates.forEach((candidate) => candidates.add(candidate));

    if (process.platform === 'darwin') {
        [
            '/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home/bin/java',
            '/Library/Java/JavaVirtualMachines/zulu-21.jdk/Contents/Home/bin/java',
            '/usr/bin/java'
        ].forEach((candidate) => candidates.add(candidate));
    }

    if (process.platform === 'win32') {
        [
            'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe',
            'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.0.35-hotspot\\bin\\java.exe'
        ].forEach((candidate) => candidates.add(candidate));
    }

    if (process.platform === 'linux') {
        [
            '/usr/bin/java',
            '/usr/lib/jvm/java-21-openjdk/bin/java',
            '/usr/lib/jvm/temurin-21-jdk/bin/java'
        ].forEach((candidate) => candidates.add(candidate));
    }

    return Array.from(candidates)
        .filter((candidate) => fs.existsSync(candidate))
        .map((candidate) => ({
            value: candidate,
            label: candidate
        }));
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
    return app.getVersion?.() || '0.1.0';
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

async function getModrinthCategories() {
    const payload = await fetchJson(`${MODRINTH_API_BASE}/tag/category`, {
        headers: {
            'User-Agent': MODRINTH_USER_AGENT
        }
    });

    const baseFilters = [{ value: 'all', label: 'All' }];
    const categories = (payload || [])
        .filter((item) => item.project_type === 'mod')
        .map((item) => ({
            value: item.name,
            label: item.name,
            header: item.header || ''
        }));

    const seen = new Set();
    return [...baseFilters, ...categories].filter((item) => {
        if (seen.has(item.value)) {
            return false;
        }

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
        loaders: ALLOWED_BUILD_LOADERS.filter((name) => name === 'vanilla' || name === 'optifine' || loaders.includes(name))
    };
}

async function searchModrinthMods(query, gameVersion = DEFAULT_GAME_VERSION, loader = DEFAULT_LOADER, category = 'all', limit = 12, offset = 0) {
    const facets = [
        ['project_type:mod'],
        [`categories:${loader}`],
        [`versions:${gameVersion}`]
    ];

    if (category && category !== 'all') {
        facets.push([`categories:${category}`]);
    }

    const url = new URL(`${MODRINTH_API_BASE}/search`);
    if (query) {
        url.searchParams.set('query', query);
    }
    url.searchParams.set('limit', String(Math.max(1, Number(limit) || 12)));
    url.searchParams.set('offset', String(Math.max(0, Number(offset) || 0)));
    url.searchParams.set('index', query ? 'relevance' : 'downloads');
    url.searchParams.set('facets', JSON.stringify(facets));

    const payload = await fetchJson(url, {
        headers: {
            'User-Agent': MODRINTH_USER_AGENT
        }
    });

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
            raw: item
        }))
    };
}

async function getModrinthDownload(projectId, gameVersion = DEFAULT_GAME_VERSION, loader = DEFAULT_LOADER) {
    const url = new URL(`${MODRINTH_API_BASE}/project/${projectId}/version`);
    url.searchParams.set('loaders', JSON.stringify([loader]));
    url.searchParams.set('game_versions', JSON.stringify([gameVersion]));
    url.searchParams.set('include_changelog', 'false');

    const versions = await fetchJson(url, {
        headers: {
            'User-Agent': MODRINTH_USER_AGENT
        }
    });

    const version = versions.find((item) => Array.isArray(item.files) && item.files.length > 0);

    if (!version) {
        throw new Error('Не удалось подобрать совместимую версию Modrinth.');
    }

    const file = version.files.find((entry) => entry.primary) || version.files[0];

    return {
        url: file.url,
        filename: file.filename,
        versionName: version.version_number || version.name,
        version
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

function listInstalledMods(buildId = null) {
    const activeBuild = buildId ? readBuild(buildId) : getActiveBuild();

    if (!activeBuild) {
        throw new Error('Сборка не найдена.');
    }

    fs.mkdirSync(activeBuild.modsPath, { recursive: true });

    const metadata = loadBuildModsMeta(activeBuild.id);
    const files = fs.readdirSync(activeBuild.modsPath, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.jar(?:\.disabled)?$/i.test(entry.name))
        .map((entry) => {
            const filename = entry.name;
            const enabled = !filename.endsWith('.disabled');
            const meta = metadata[filename] || metadata[filename.replace(/\.disabled$/i, '')] || null;

            return {
                id: filename,
                filename,
                projectId: meta?.projectId || null,
                title: meta?.title || inferModTitle(filename),
                author: meta?.author || '',
                versionName: meta?.versionName || '',
                enabled,
                path: path.join(activeBuild.modsPath, filename),
                normalizedName: normalizeModKey(meta?.title || filename),
                source: meta?.source || 'file',
                installedAt: meta?.installedAt || ''
            };
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

function toggleInstalledMod(filename, buildId = null) {
    const activeBuild = buildId ? readBuild(buildId) : getActiveBuild();

    if (!activeBuild) {
        throw new Error('Сборка не найдена.');
    }

    const currentPath = path.join(activeBuild.modsPath, filename);
    if (!fs.existsSync(currentPath)) {
        throw new Error('Мод не найден.');
    }

    const nextFilename = filename.endsWith('.disabled')
        ? filename.replace(/\.disabled$/i, '')
        : `${filename}.disabled`;
    const nextPath = path.join(activeBuild.modsPath, nextFilename);

    fs.renameSync(currentPath, nextPath);
    updateInstalledModFilenameMeta(activeBuild.id, filename, nextFilename);

    return listInstalledMods(activeBuild.id);
}

function deleteInstalledMod(filename, buildId = null) {
    const activeBuild = buildId ? readBuild(buildId) : getActiveBuild();

    if (!activeBuild) {
        throw new Error('Сборка не найдена.');
    }

    const targetPath = path.join(activeBuild.modsPath, filename);
    if (!fs.existsSync(targetPath)) {
        throw new Error('Мод не найден.');
    }

    fs.rmSync(targetPath, { force: true });

    const metadata = loadBuildModsMeta(activeBuild.id);
    delete metadata[filename];
    delete metadata[filename.replace(/\.disabled$/i, '')];
    saveBuildModsMeta(activeBuild.id, metadata);

    return listInstalledMods(activeBuild.id);
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
        isDefault: false
    };

    fs.mkdirSync(getBuildDir(nextId), { recursive: true });
    fs.mkdirSync(getBuildModsPath(nextId), { recursive: true });
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
        isDefault: Boolean(current.isDefault)
    };

    fs.mkdirSync(getBuildModsPath(nextId), { recursive: true });
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

async function searchMods({ query, gameVersion = DEFAULT_GAME_VERSION, loader = DEFAULT_LOADER, category = 'all', page = 1, limit = 12 }) {
    const safeLimit = Math.max(1, Number(limit) || 12);
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;
    return searchModrinthMods((query || '').trim(), gameVersion, loader, category, safeLimit, offset);
}

async function downloadMod({ modId, gameVersion = DEFAULT_GAME_VERSION, loader = DEFAULT_LOADER, title = '', author = '' }) {
    const activeBuild = getActiveBuild();
    const resolved = await getModrinthDownload(modId, gameVersion, loader);
    const destination = await downloadFile(activeBuild.modsPath, resolved.url, resolved.filename);
    setBuildModMeta(activeBuild.id, path.basename(destination), {
        projectId: modId,
        title: title || inferModTitle(resolved.filename),
        author: author || '',
        versionName: resolved.versionName || '',
        source: 'modrinth',
        installedAt: new Date().toISOString()
    });

    const installedModsState = listInstalledMods(activeBuild.id);
    const installedKeys = new Set(installedModsState.mods.flatMap((mod) => [
        mod.projectId ? String(mod.projectId) : '',
        mod.normalizedName || ''
    ]).filter(Boolean));
    const dependencies = await resolveRequiredDependencies(resolved.version, gameVersion, loader);
    const missingDependencies = dependencies.filter((dependency) => {
        const dependencyKey = normalizeModKey(dependency.title || dependency.filename || dependency.projectId);
        return !installedKeys.has(String(dependency.projectId)) && !installedKeys.has(dependencyKey);
    });

    return {
        filePath: destination,
        filename: path.basename(destination),
        folder: activeBuild.modsPath,
        versionName: resolved.versionName,
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
    mainWindow = new BrowserWindow({
        width: 650,
        height: 450,
        minWidth: 650,
        minHeight: 450,
        transparent: true,
        center: true,
        title: "KrakvaMCL",
        frame: false,
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
            sandbox: false
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.setMenuBarVisibility(false);
        mainWindow.show();
    });

    mainWindow.loadFile(path.join(__dirname, 'splash.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    migrateLegacyData();
    ensureDefaultBuild();
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
    return saveSettings(settings);
});

ipcMain.handle('system:info', () => {
    return {
        ...getSystemInfo(),
        javaOptions: [{ value: 'auto', label: 'AutoJava' }, ...getJavaCandidates()]
    };
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
    return searchMods(payload || {});
});

ipcMain.handle('mods:download', async (_event, payload) => {
    return downloadMod(payload || {});
});

ipcMain.handle('mods:list-installed', (_event, buildId) => {
    return listInstalledMods(buildId || null);
});

ipcMain.handle('mods:toggle-installed', (_event, payload) => {
    return toggleInstalledMod(payload?.filename, payload?.buildId || null);
});

ipcMain.handle('mods:delete-installed', (_event, payload) => {
    return deleteInstalledMod(payload?.filename, payload?.buildId || null);
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

ipcMain.handle('mods:filters', async () => {
    return getModrinthCategories();
});

ipcMain.handle('mods:open-folder', async () => {
    const activeBuild = getActiveBuild();
    const result = await shell.openPath(activeBuild.modsPath);

    if (result) {
        throw new Error(result);
    }

    return activeBuild.modsPath;
});

ipcMain.handle('builds:list', () => {
    return listBuildsState();
});

ipcMain.handle('builds:options', async () => {
    try {
        return await getBuildOptions();
    } catch {
        return {
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
    }
});

ipcMain.handle('builds:create', (_event, payload) => {
    return createBuild(payload || {});
});

ipcMain.handle('builds:update', (_event, payload) => {
    return updateBuild(payload?.id, payload || {});
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

ipcMain.handle('launcher-updates:check', async (_event, payload) => {
    return checkLauncherUpdates(payload?.token || loadSettings().githubToken || '');
});

ipcMain.handle('launcher-updates:apply', async (_event, payload) => {
    return applyLauncherUpdate(payload?.token || loadSettings().githubToken || '');
});
