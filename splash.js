// Элементы
const progressBar = document.querySelector('.loader-progress');
const statusText = document.querySelector('.loader-status');
const splashCard = document.querySelector('.splash');
const splashClose = document.querySelector('.splash-close');

// Этапы загрузки
const loadingStages = [
    { name: 'Загрузка сборок', duration: 1000 },
    { name: 'Загрузка аккаунтов', duration: 600 },
    { name: 'Загрузка модов', duration: 800 },
    { name: 'Загрузка настроек', duration: 600 },
    { name: 'Завершение', duration: 300 }
];

let totalDuration = loadingStages.reduce((sum, stage) => sum + stage.duration, 0);
let animationFrame = null;

// Кеш данные
let cacheData = null;
const CACHE_VERSION = 1;

// Функция установки прогресса
function setProgress(percent) {
    progressBar.style.width = Math.min(percent, 100) + '%';
}

// Функция обновления статуса
function updateStatusText(message) {
    statusText.textContent = message;
}

// Загрузка кеша с диска
async function loadCache() {
    try {
        // Пытаемся загрузить кеш через API
        if (window.launcherCache?.load) {
            cacheData = await window.launcherCache.load('app-cache');
            if (cacheData?.version !== CACHE_VERSION) {
                cacheData = null;
            }
        } else if (window.api?.readFile) {
            const cacheContent = await window.api.readFile('cache.json');
            if (cacheContent) {
                cacheData = JSON.parse(cacheContent);
                if (cacheData?.version !== CACHE_VERSION) {
                    cacheData = null;
                }
            }
        }
        console.log('Кеш загружен:', cacheData ? 'да' : 'нет');
    } catch (e) {
        console.warn('Ошибка загрузки кеша:', e);
        cacheData = null;
    }
}

// Сохранение кеша на диск
async function saveCache(data) {
    try {
        const cacheToSave = {
            version: CACHE_VERSION,
            timestamp: Date.now(),
            builds: data.buildsState?.builds?.map(b => ({
                id: b.id,
                name: b.name
            })) || [],
            accounts: data.accounts?.accounts?.map(a => ({
                id: a.id,
                name: a.name,
                type: a.type
            })) || [],
            buildOptions: data.buildOptions || {},
            modFilters: data.filters || [],
            activeBuildId: data.buildsState?.activeBuildId
        };

        if (window.launcherCache?.save) {
            await window.launcherCache.save('app-cache', cacheToSave);
        } else if (window.api?.writeFile) {
            await window.api.writeFile('cache.json', JSON.stringify(cacheToSave, null, 2));
        }
        console.log('Кеш сохранён');
    } catch (e) {
        console.warn('Ошибка сохранения кеша:', e);
    }
}

// Использование кеша для быстрого отображения
function applyCache() {
    if (!cacheData) return;
    
    const preloadData = window.__krakvamclPreloadedData || {};
    
    // Применяем кешированные сборки
    if (cacheData.builds?.length) {
        preloadData.buildsState = {
            builds: cacheData.builds,
            activeBuildId: cacheData.activeBuildId
        };
    }
    
    // Применяем кешированные аккаунты
    if (cacheData.accounts?.length) {
        preloadData.accounts = {
            accounts: cacheData.accounts,
            activeAccountId: cacheData.accounts[0]?.id
        };
    }
    
    // Применяем опции сборок
    if (cacheData.buildOptions) {
        preloadData.buildOptions = cacheData.buildOptions;
    }
    
    // Применяем фильтры модов
    if (cacheData.modFilters?.length) {
        preloadData.filters = cacheData.modFilters;
    }
    
    window.__krakvamclPreloadedData = preloadData;
}

// Функция загрузки данных параллельно
async function loadPreloadData() {
    try {
        window.__krakvamclPreloadedData = {
            settings: null,
            systemInfo: null,
            buildsState: null,
            filters: null,
            buildOptions: null,
            installedState: null,
            gameState: null,
            accounts: null
        };

        // Загружаем кеш для быстрого отображения
        await loadCache();
        applyCache();

        // Параллельная загрузка всех данных
        const loadPromises = [];
        
        // Загрузка сборок и опций
        loadPromises.push(
            (async () => {
                try {
                    updateStatusText('Загрузка сборок...');
                    if (window.launcherBuilds?.list) {
                        const buildsData = await window.launcherBuilds.list();
                        window.__krakvamclPreloadedData.buildsState = buildsData;
                    }
                    if (window.launcherBuilds?.getOptions) {
                        const buildOptions = await window.launcherBuilds.getOptions();
                        window.__krakvamclPreloadedData.buildOptions = buildOptions;
                    }
                    setProgress(25);
                } catch (e) {
                    console.warn('Ошибка при загрузке сборок:', e);
                }
            })()
        );

        // Загрузка аккаунтов
        loadPromises.push(
            (async () => {
                try {
                    updateStatusText('Загрузка аккаунтов...');
                    if (window.launcherAccounts?.list) {
                        const accountsData = await window.launcherAccounts.list();
                        window.__krakvamclPreloadedData.accounts = accountsData;
                    }
                    setProgress(50);
                } catch (e) {
                    console.warn('Ошибка при загрузке аккаунтов:', e);
                }
            })()
        );

        // Загрузка модов
        loadPromises.push(
            (async () => {
                try {
                    updateStatusText('Загрузка модов...');
                    if (window.launcherMods?.getFilters) {
                        const filters = await window.launcherMods.getFilters();
                        window.__krakvamclPreloadedData.filters = filters;
                    }
                    if (window.launcherMods?.listInstalled) {
                        const installedMods = await window.launcherMods.listInstalled();
                        window.__krakvamclPreloadedData.installedState = installedMods;
                    }
                    setProgress(70);
                } catch (e) {
                    console.warn('Ошибка при загрузке модов:', e);
                }
            })()
        );

        // Загрузка настроек
        loadPromises.push(
            (async () => {
                try {
                    updateStatusText('Загрузка настроек...');
                    if (window.launcherSettings?.load) {
                        const settings = await window.launcherSettings.load();
                        window.__krakvamclPreloadedData.settings = settings;
                    }
                    if (window.launcherSettings?.getSystemInfo) {
                        const systemInfo = await window.launcherSettings.getSystemInfo();
                        window.__krakvamclPreloadedData.systemInfo = systemInfo;
                    }
                    if (window.launcherGame?.getState) {
                        const gameState = await window.launcherGame.getState();
                        window.__krakvamclPreloadedData.gameState = gameState;
                    }
                    setProgress(85);
                } catch (e) {
                    console.warn('Ошибка при загрузке настроек:', e);
                }
            })()
        );

        // Ждём всех загрузок параллельно
        await Promise.all(loadPromises);
        setProgress(100);

        // Сохраняем обновленный кеш
        await saveCache(window.__krakvamclPreloadedData);

        return true;
    } catch (error) {
        console.error('Ошибка предзагрузки:', error);
        return false;
    }
}

// Функция завершения загрузки
function finishLoading() {
    updateStatusText('Готово!');
    statusText.style.color = 'rgba(100, 255, 150, 0.9)';
    
    if (splashCard) {
        splashCard.classList.add('is-ready');
    }
    
    setTimeout(() => {
        if (splashCard) {
            splashCard.classList.add('is-transitioning');
        }
        sessionStorage.setItem('main_transition', 'expand');
    }, 220);

    setTimeout(() => {
        window.location.href = 'main.html';
    }, 760);
}

// Функция обработки ошибок
function handleError(errorMessage) {
    updateStatusText('Ошибка загрузки');
    statusText.style.color = 'rgba(255, 100, 100, 0.9)';
    
    if (splashCard) {
        splashCard.classList.add('has-error');
    }
}

// Запуск предзагрузки
async function startPreloading() {
    try {
        setProgress(5);
        const success = await loadPreloadData();
        
        if (success) {
            finishLoading();
        } else {
            handleError();
            // Всё равно переходим на главный экран через 2 секунды
            setTimeout(() => {
                window.location.href = 'main.html';
            }, 2000);
        }
    } catch (error) {
        console.error('Критическая ошибка:', error);
        handleError();
        
        // Всё равно переходим на главный экран через 2 секунды
        setTimeout(() => {
            window.location.href = 'main.html';
        }, 2000);
    }
}

// Запуск с небольшой задержкой для инициализации API
setTimeout(() => {
    startPreloading();
}, 300);

if (splashClose) {
    splashClose.addEventListener('click', () => {
        if (window.launcherWindow?.close) {
            window.launcherWindow.close();
            return;
        }

        window.close();

        setTimeout(() => {
            if (!window.closed) {
                document.body.style.opacity = '0';
                setTimeout(() => {
                    window.location.href = 'about:blank';
                }, 180);
            }
        }, 40);
    });
}

// Обработка ошибок окна
window.addEventListener('error', function(e) {
    console.error('Ошибка окна:', e);
    handleError();
});
