const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcherWindow', {
    minimize() {
        ipcRenderer.send('window:minimize');
    },
    close() {
        ipcRenderer.send('window:close');
    },
    onTransition(callback) {
        ipcRenderer.removeAllListeners('launcher:transition');
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on('launcher:transition', listener);
        return () => ipcRenderer.removeListener('launcher:transition', listener);
    },
    isDesktop: true
});

contextBridge.exposeInMainWorld('launcherSettings', {
    load() {
        return ipcRenderer.invoke('settings:load');
    },
    save(settings) {
        return ipcRenderer.invoke('settings:save', settings);
    },
    getSystemInfo() {
        return ipcRenderer.invoke('system:info');
    },
    selectJava() {
        return ipcRenderer.invoke('java:select');
    },
    onJavaOptionsUpdated(callback) {
        ipcRenderer.removeAllListeners('system:java-options-updated');
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on('system:java-options-updated', listener);
        return () => ipcRenderer.removeListener('system:java-options-updated', listener);
    }
});

contextBridge.exposeInMainWorld('launcherMods', {
    search(payload) {
        return ipcRenderer.invoke('mods:search', payload);
    },
    download(payload) {
        return ipcRenderer.invoke('mods:download', payload);
    },
    getState() {
        return ipcRenderer.invoke('mods:state');
    },
    openFolder(payload) {
        return ipcRenderer.invoke('mods:open-folder', payload);
    },
    getFilters(payload) {
        return ipcRenderer.invoke('mods:filters', payload);
    },
    listInstalled(payload) {
        return ipcRenderer.invoke('mods:list-installed', payload);
    },
    toggleInstalled(payload) {
        return ipcRenderer.invoke('mods:toggle-installed', payload);
    },
    deleteInstalled(payload) {
        return ipcRenderer.invoke('mods:delete-installed', payload);
    },
    installDependencies(payload) {
        return ipcRenderer.invoke('mods:install-dependencies', payload);
    },
    openReport(filePath) {
        return ipcRenderer.invoke('mods:open-report', filePath);
    }
});

contextBridge.exposeInMainWorld('launcherBuilds', {
    list() {
        return ipcRenderer.invoke('builds:list');
    },
    getOptions() {
        return ipcRenderer.invoke('builds:options');
    },
    create(payload) {
        return ipcRenderer.invoke('builds:create', payload);
    },
    update(payload) {
        return ipcRenderer.invoke('builds:update', payload);
    },
    delete(buildId) {
        return ipcRenderer.invoke('builds:delete', buildId);
    },
    setActive(buildId) {
        return ipcRenderer.invoke('builds:set-active', buildId);
    },
    openFolder(buildId) {
        return ipcRenderer.invoke('builds:open-folder', buildId);
    },
    export(buildId) {
        return ipcRenderer.invoke('builds:export', buildId);
    },
    importJson(payload) {
        return ipcRenderer.invoke('builds:import-json', payload);
    },
    importConfigs(buildId) {
        return ipcRenderer.invoke('builds:import-configs', buildId);
    }
});

contextBridge.exposeInMainWorld('launcherGame', {
    downloadVersion(buildId) {
        return ipcRenderer.invoke('game:download-version', buildId);
    },
    launch(payload) {
        return ipcRenderer.invoke('game:launch', payload);
    },
    getState() {
        return ipcRenderer.invoke('game:state');
    },
    getStatus() {
        return ipcRenderer.invoke('game:get-status');
    },
    onStatus(callback) {
        // Удаляем все старые listeners перед регистрацией нового —
        // защита от накопления дубликатов при hot-reload или повторных вызовах
        ipcRenderer.removeAllListeners('game:status');
        const listener = (_event, payload) => {
            try {
                callback(payload);
            } catch (err) {
                console.error('[preload] game:status callback error:', err);
            }
        };
        ipcRenderer.on('game:status', listener);
        return () => ipcRenderer.removeListener('game:status', listener);
    }
});

contextBridge.exposeInMainWorld('launcherUpdates', {
    check(payload) {
        return ipcRenderer.invoke('launcher-updates:check', payload);
    },
    apply(payload) {
        return ipcRenderer.invoke('launcher-updates:apply', payload);
    }
});

contextBridge.exposeInMainWorld('launcherPresence', {
    update(payload) {
        return ipcRenderer.invoke('presence:update', payload);
    }
});
