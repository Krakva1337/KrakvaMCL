const DEFAULT_LANGUAGE = 'Русский';
const DEFAULT_GAME_VERSION = '1.21.11';
const DEFAULT_LOADER = 'vanilla';
const DEFAULT_BUILD_ID = 'Standart';
const ACCOUNTS_STORAGE_KEY = 'krakvamcl.accounts';
const MODS_CACHE_STORAGE_KEY = 'krakvamcl.mods.cache';
const DEFAULT_ACCOUNT_NAME = 'Krakva_';
const MODS_PAGE_SIZE = 12;
const INSTALLED_MODS_PAGE_SIZE = 12;

const state = {
    activeView: 'play',
    modsType: 'mods',
    settings: {
        language: DEFAULT_LANGUAGE,
        memoryMb: 4096,
        javaPath: 'auto',
        darkMenus: true,
        activeBuildId: DEFAULT_BUILD_ID,
        minimizeToTrayOnLaunch: false,
        reopenLauncherOnGameExit: true,
        githubToken: ''
    },
    systemInfo: {
        totalRamMb: 8192,
        javaOptions: [{ value: 'auto', label: 'AutoJava' }],
        launcherVersion: '0.1.0'
    },
    buildOptions: {
        gameVersions: [DEFAULT_GAME_VERSION],
        loaders: ['vanilla', 'forge', 'fabric', 'neoforge']
    },
    builds: [],
    activeBuildId: DEFAULT_BUILD_ID,
    modFilters: [],
    modsResults: [],
    installedMods: [],
    accounts: [],
    activeAccountId: null,
    accountModalMode: 'create',
    editingAccountId: null,
    modsTotalCount: 0,
    modsCurrentPage: 1,
    installedModsCurrentPage: 1,
    modsQuery: '',
    modsCategory: 'all',
    isSearchingMods: false,
    searchHistory: [],
    searchScope: 'mods',
    modsCache: {},
    modsTypeCaches: {
        mods: {},
        resourcepacks: {},
        shaderpacks: {},
        datapacks: {}
    },
    installedModsCache: {},
    installedModIcons: {},
    installedModIconRequests: {},
    playFilterVersion: 'all',
    playFilterLoader: 'all',
    buildModalMode: 'create',
    editingBuildId: null,
    lastCrashReportPath: '',
    launchStatus: {
        title: 'Ожидание',
        detail: 'Версия ещё не скачана.',
        progress: 0,
        speedBytes: 0,
        command: ''
    },
    updateInfo: {
        currentVersion: '0.1.0',
        remoteVersion: '',
        updateAvailable: false,
        checking: false,
        status: 'Статус обновления пока не проверен.'
    },
    saveStateTimer: null,
    searchDebounceTimer: null
};

let dependencyPromptResolver = null;

const translations = {
    Русский: {
        nav_play: 'Играть',
        nav_mods: 'Modrinth',
        nav_mod_manager: 'Менеджер',
        nav_builds: 'Сборки',
        nav_news: 'Новости',
        nav_settings: 'Настройки',
        title_app: 'KrakvaMCL',
        toolbar_search_open: 'Открыть поиск',
        toolbar_search_close: 'Свернуть поиск',
        toolbar_search_placeholder: 'Поиск модов',
        control_minimize: 'Свернуть',
        control_close: 'Закрыть',
        play_label: 'Играть',
        play_title: 'Сборка готова к запуску',
        play_copy: 'Выберите сборку, аккаунт и загрузчик для быстрого старта.',
        play_select: 'Быстрый выбор',
        play_launch: 'Играть',
        play_launch_wait: 'Запуск скоро будет подключён.',
        play_loaders_title: 'Быстрые загрузчики',
        play_loaders_copy: 'Переключайтесь между популярными загрузчиками или создавайте новую сборку с нужным профилем.',
        play_loader_action_open: 'Открыть',
        play_loader_action_create: 'Создать',
        play_picker_label: 'Играть',
        play_picker_title: 'Быстрый выбор',
        play_filter_version_label: 'Версия Minecraft',
        play_filter_loader_label: 'Загрузчик',
        play_filter_all_versions: 'Все версии',
        play_filter_all_loaders: 'Все загрузчики',
        play_picker_empty: 'Нет сборок под выбранные фильтры.',
        play_pick_use: 'Выбрать',
        mods_label: 'Modrinth',
        mods_title: 'Моды',
        mods_type_mods: 'Моды',
        mods_type_resourcepacks: 'Ресурс-паки',
        mods_type_shaderpacks: 'Шейдеры',
        mods_type_datapacks: 'Датапаки',
        mods_type_modal_title: 'Выберите тип содержимого',
        mod_manager_label: 'Менеджер',
        mod_manager_title: 'Моды в сборке',
        mod_manager_current_build: 'Текущая сборка',
        mod_manager_loading: 'Загрузка установленных модов...',
        mod_manager_empty: 'В этой сборке пока нет установленных модов.',
        mods_filter_label: 'Категория',
        mods_folder_aria: 'Открыть папку mods активной сборки',
        build_folder_aria: 'Открыть папку активной сборки',
        mods_search_label: 'Поиск модов',
        mods_search_idle: 'Популярные моды для текущей сборки.',
        mods_search_loading: 'Ищу моды на Modrinth...',
        mods_search_error: 'Не удалось загрузить моды.',
        mods_search_empty: 'Совпадений не найдено.',
        pagination_prev: 'Назад',
        pagination_next: 'Далее',
        pagination_page: 'Страница',
        mods_empty_title: 'Популярные моды',
        mods_empty_copy: 'Здесь показываются популярные моды для текущей версии Minecraft и выбранного загрузчика.',
        mods_no_results_title: 'Ничего не найдено',
        mods_no_results_copy: 'Попробуйте другой запрос, версию Minecraft или категорию.',
        mods_author: 'Автор',
        mods_downloads: 'Скачиваний',
        mods_install: 'Установить',
        mods_installing: 'Установка...',
        mods_installed: 'Установлено',
        mods_delete: 'Удалить',
        mods_disable: 'Выключить',
        mods_enable: 'Включить',
        mods_enabled_badge: 'Включен',
        mods_disabled_badge: 'Выключен',
        mods_detected_badge: 'Уже скачан',
        mods_dependency_prompt: 'Для этого мода нужны зависимости:\n\n{list}\n\nУстановить их тоже?',
        mods_dependency_installed: 'Зависимости установлены.',
        dependency_modal_label: 'Зависимости',
        dependency_modal_title: 'Найдены зависимости мода',
        dependency_modal_text: 'Для корректной работы мода нужны дополнительные файлы.',
        dependency_modal_cancel: 'Позже',
        dependency_modal_confirm: 'Установить всё',
        mods_open_folder_success: 'Открыта папка mods активной сборки.',
        mods_installed_to: 'Мод добавлен в папку mods сборки',
        build_open_folder_success: 'Открыта папка активной сборки.',
        mods_deleted: 'Мод удалён.',
        mods_toggled: 'Состояние мода обновлено.',
        builds_label: 'Сборки',
        builds_title: 'Сборки',
        builds_create_aria: 'Создать сборку',
        builds_empty_title: 'Пока только стандартная сборка',
        builds_empty_copy: 'Нажмите + и создайте отдельную папку сборки с версией Minecraft и загрузчиком.',
        build_active: 'Активна',
        build_default: 'По умолчанию',
        build_path: 'Путь',
        build_edit_aria: 'Изменить сборку',
        build_delete_aria: 'Удалить сборку',
        build_delete_confirm: 'Удалить сборку "{name}"? Все файлы внутри её папки будут удалены.',
        build_delete_default_error: 'Стандартную сборку удалить нельзя.',
        build_saved: 'Сборка сохранена.',
        build_deleted: 'Сборка удалена.',
        build_selected: 'Активная сборка обновлена.',
        build_modal_label: 'Сборка',
        build_modal_create_title: 'Новая сборка',
        build_modal_edit_title: 'Изменить сборку',
        build_name_label: 'Название сборки',
        build_name_placeholder: 'Например, Vanilla Plus',
        build_version_label: 'Версия Minecraft',
        build_loader_label: 'Загрузчик',
        build_cancel: 'Отмена',
        build_save: 'Сохранить',
        build_create: 'Создать',
        news_label: 'Новости',
        news_title: 'Лента обновлений',
        news_copy: 'Подготовлено место под новости лаунчера, релизы сборок и полезные уведомления.',
        settings_label: 'Настройки',
        settings_title: 'Параметры',
        save_unsaved: 'Не сохранено',
        save_saving: 'Сохранение...',
        save_saved: 'Сохранено',
        language_label: 'Язык интерфейса',
        memory_label: 'Память для запуска',
        memory_hint: 'Автоопределение RAM...',
        java_label: 'Java',
        java_select: 'Выбрать Java',
        java_hint: 'AutoJava сама скачивает подходящую Java под версию Minecraft; ниже показаны и найденные локальные установки.',
        dark_menus_label: 'Тёмные меню',
        dark_menus_hint: 'Делает выпадающие списки и меню темнее.',
        tray_label: 'Сворачивать лаунчер в трей при запуске',
        tray_hint: 'Настройка будет использоваться при запуске игры.',
        reopen_launcher_label: 'Открывать лаунчер после выхода из игры',
        reopen_launcher_hint: 'После завершения процесса окно лаунчера будет снова показано.',
        launcher_version_label: 'Version',
        launcher_version_hint: 'Текущая версия лаунчера.',
        github_token_label: 'GitHub Token',
        github_token_hint: 'Нужен для доступа к приватному репозиторию.',
        github_token_placeholder: 'ghp_xxx',
        updates_check: 'Проверить',
        updates_apply: 'Обновить',
        updates_status_label: 'Обновление',
        updates_status_idle: 'Статус обновления пока не проверен.',
        updates_status_missing_token: 'Добавьте GitHub token, чтобы проверять обновления приватного репозитория.',
        updates_status_checking: 'Проверяю версию на GitHub...',
        updates_status_latest: 'У вас уже последняя версия.',
        updates_status_available: 'Доступна новая версия: {version}.',
        updates_status_applying: 'Скачиваю и применяю обновление...',
        updates_status_restart: 'Обновление применено. Лаунчер перезапускается...',
        default_build_name: 'Стандарт',
        all_filter: 'Все',
        unknown_author: 'Неизвестно',
        status_build: 'Сборка',
        status_loader: 'Загрузчик',
        status_version: 'Версия',
        search_scope_hint: 'Поиск работает для вкладки модов.',
        error_prefix: 'Ошибка',
        version_label: 'Версия',
        loader_label: 'Загрузчик'
        ,
        account_label: 'Аккаунт',
        account_modal_label: 'Аккаунты',
        account_modal_title: 'Менеджер аккаунтов',
        account_editor_label: 'Ник игрока',
        account_editor_hint: 'Пока что локальный аккаунт по нику, без официального входа.',
        account_name_placeholder: 'Введите ник',
        account_add: 'Добавить',
        account_save: 'Сохранить',
        account_cancel: 'Отмена',
        account_empty_title: 'Аккаунтов пока нет',
        account_empty_copy: 'Добавьте ник и выберите его активным для запуска.',
        account_active: 'Активен',
        account_use: 'Выбрать',
        account_edit: 'Изменить',
        account_delete: 'Удалить',
        account_delete_confirm: 'Удалить аккаунт "{name}"?',
        account_status_saved: 'Аккаунты обновлены.',
        launch_status_label: 'Статус запуска',
        launch_status_idle: 'Версия ещё не скачана.',
        launch_modal_label: 'Запуск',
        launch_modal_title: 'Статус игры',
        launch_progress_title: 'Подготовка',
        launch_command_label: 'Команда',
        launch_open_report: 'Открыть отчёт',
        builds_import_json: 'JSON',
        builds_import: 'Импорт',
        builds_export: 'Экспорт',
        build_import_modal_label: 'Импорт',
        build_import_modal_title: 'JSON ключ сборки',
        build_import_text_label: 'Вставьте JSON ключ',
        build_import_text_hint: 'Будет создана новая сборка с указанной версией, загрузчиком и модами из ключа.',
        build_import_submit: 'Импортировать',
        build_size: 'Размер',
        build_exported: 'Сборка экспортирована.',
        build_imported: 'Сборка импортирована.',
        build_configs_import: 'Конфиги',
        build_configs_imported: 'Конфиги сборки импортированы.'
    },
    English: {
        nav_play: 'Play',
        nav_mods: 'Modrinth',
        nav_mod_manager: 'Manager',
        nav_builds: 'Builds',
        nav_news: 'News',
        nav_settings: 'Settings',
        title_app: 'KrakvaMCL',
        toolbar_search_open: 'Open search',
        toolbar_search_close: 'Collapse search',
        toolbar_search_placeholder: 'Search mods',
        control_minimize: 'Minimize',
        control_close: 'Close',
        play_label: 'Play',
        play_title: 'Build is ready to launch',
        play_copy: 'Choose a build, account, and loader for a quick start.',
        play_select: 'Quick Select',
        play_launch: 'Play',
        play_launch_wait: 'Game launch will be wired up soon.',
        play_loaders_title: 'Quick Loaders',
        play_loaders_copy: 'Switch between popular loaders or create a fresh build with the selected profile.',
        play_loader_action_open: 'Open',
        play_loader_action_create: 'Create',
        play_picker_label: 'Play',
        play_picker_title: 'Quick Select',
        play_filter_version_label: 'Minecraft Version',
        play_filter_loader_label: 'Loader',
        play_filter_all_versions: 'All versions',
        play_filter_all_loaders: 'All loaders',
        play_picker_empty: 'No builds match the selected filters.',
        play_pick_use: 'Select',
        mods_label: 'Modrinth',
        mods_title: '',
        mods_type_mods: 'Mods',
        mods_type_resourcepacks: 'Resource Packs',
        mods_type_shaderpacks: 'Shaders',
        mods_type_datapacks: 'Data Packs',
        mods_type_modal_title: 'Select content type',
        mod_manager_label: 'Manager',
        mod_manager_title: 'Build Mods',
        mod_manager_current_build: 'Current build',
        mod_manager_loading: 'Loading installed mods...',
        mod_manager_empty: 'There are no installed mods in this build yet.',
        mods_filter_label: 'Category',
        mods_folder_aria: 'Open active build mods folder',
        build_folder_aria: 'Open active build folder',
        mods_search_label: 'Mod Search',
        mods_search_idle: 'Popular mods for the current build.',
        mods_search_loading: 'Searching Modrinth...',
        mods_search_error: 'Failed to load mods.',
        mods_search_empty: 'No matches found.',
        pagination_prev: 'Prev',
        pagination_next: 'Next',
        pagination_page: 'Page',
        mods_empty_title: 'Popular Mods',
        mods_empty_copy: 'This list shows popular mods for the current Minecraft version and selected loader.',
        mods_no_results_title: 'Nothing found',
        mods_no_results_copy: 'Try another query, Minecraft version, or category.',
        mods_author: 'Author',
        mods_downloads: 'Downloads',
        mods_install: 'Install',
        mods_installing: 'Installing...',
        mods_installed: 'Installed',
        mods_delete: 'Delete',
        mods_disable: 'Disable',
        mods_enable: 'Enable',
        mods_enabled_badge: 'Enabled',
        mods_disabled_badge: 'Disabled',
        mods_detected_badge: 'Downloaded',
        mods_dependency_prompt: 'This mod requires dependencies:\n\n{list}\n\nInstall them too?',
        mods_dependency_installed: 'Dependencies installed.',
        dependency_modal_label: 'Dependencies',
        dependency_modal_title: 'Required mod dependencies found',
        dependency_modal_text: 'Additional files are needed for the mod to work correctly.',
        dependency_modal_cancel: 'Later',
        dependency_modal_confirm: 'Install all',
        mods_open_folder_success: 'Opened the active build mods folder.',
        mods_installed_to: 'The mod was added to the build mods folder',
        build_open_folder_success: 'Opened the active build folder.',
        mods_deleted: 'Mod deleted.',
        mods_toggled: 'Mod state updated.',
        builds_label: 'Builds',
        builds_title: 'Build Management',
        builds_create_aria: 'Create build',
        builds_empty_title: 'Only the default build exists',
        builds_empty_copy: 'Press + to create a separate build folder with its own Minecraft version and loader.',
        build_active: 'Active',
        build_default: 'Default',
        build_path: 'Path',
        build_edit_aria: 'Edit build',
        build_delete_aria: 'Delete build',
        build_delete_confirm: 'Delete build "{name}"? Everything inside its folder will be removed.',
        build_delete_default_error: 'The default build cannot be deleted.',
        build_saved: 'Build saved.',
        build_deleted: 'Build deleted.',
        build_selected: 'Active build updated.',
        build_modal_label: 'Build',
        build_modal_create_title: 'New Build',
        build_modal_edit_title: 'Edit Build',
        build_name_label: 'Build Name',
        build_name_placeholder: 'For example, Vanilla Plus',
        build_version_label: 'Minecraft Version',
        build_loader_label: 'Loader',
        build_cancel: 'Cancel',
        build_save: 'Save',
        build_create: 'Create',
        news_label: 'News',
        news_title: 'Update Feed',
        news_copy: 'Reserved for launcher news, build releases, and useful notices.',
        settings_label: 'Settings',
        settings_title: 'Launcher Settings',
        save_unsaved: 'Not saved',
        save_saving: 'Saving...',
        save_saved: 'Saved',
        language_label: 'Interface Language',
        memory_label: 'Launch Memory',
        memory_hint: 'Automatic RAM detection...',
        java_label: 'Java',
        java_select: 'Choose Java',
        java_hint: 'AutoJava downloads the matching Java for the selected Minecraft version; detected local installations are also listed below.',
        dark_menus_label: 'Dark Menus',
        dark_menus_hint: 'Makes dropdowns and menus darker.',
        tray_label: 'Minimize launcher to tray on launch',
        tray_hint: 'This setting will be used when the game starts.',
        reopen_launcher_label: 'Reopen launcher after the game exits',
        reopen_launcher_hint: 'The launcher window will be shown again when the process finishes.',
        launcher_version_label: 'Version',
        launcher_version_hint: 'Current launcher version.',
        github_token_label: 'GitHub Token',
        github_token_hint: 'Required to access the private repository.',
        github_token_placeholder: 'ghp_xxx',
        updates_check: 'Check',
        updates_apply: 'Update',
        updates_status_label: 'Update',
        updates_status_idle: 'Update status has not been checked yet.',
        updates_status_missing_token: 'Add a GitHub token to check the private repository for updates.',
        updates_status_checking: 'Checking GitHub version...',
        updates_status_latest: 'You already have the latest version.',
        updates_status_available: 'A new version is available: {version}.',
        updates_status_applying: 'Downloading and applying update...',
        updates_status_restart: 'Update applied. Restarting the launcher...',
        default_build_name: 'Standart',
        all_filter: 'All',
        unknown_author: 'Unknown',
        status_build: 'Build',
        status_loader: 'Loader',
        status_version: 'Version',
        search_scope_hint: 'Search is used on the mods tab.',
        error_prefix: 'Error',
        version_label: 'Version',
        loader_label: 'Loader',
        account_label: 'Account',
        account_modal_label: 'Accounts',
        account_modal_title: 'Account Manager',
        account_editor_label: 'Player Nickname',
        account_editor_hint: 'Local nickname-only account for now, without official sign in.',
        account_name_placeholder: 'Enter nickname',
        account_add: 'Add',
        account_save: 'Save',
        account_cancel: 'Cancel',
        account_empty_title: 'No accounts yet',
        account_empty_copy: 'Add a nickname and set it as active for launching.',
        account_active: 'Active',
        account_use: 'Select',
        account_edit: 'Edit',
        account_delete: 'Delete',
        account_delete_confirm: 'Delete account "{name}"?',
        account_status_saved: 'Accounts updated.',
        launch_status_label: 'Launch Status',
        launch_status_idle: 'The version has not been downloaded yet.',
        launch_modal_label: 'Launch',
        launch_modal_title: 'Game Status',
        launch_progress_title: 'Preparing',
        launch_command_label: 'Command',
        launch_open_report: 'Open Report',
        builds_import_json: 'JSON',
        builds_import: 'Import',
        builds_export: 'Export',
        build_import_modal_label: 'Import',
        build_import_modal_title: 'Build JSON Key',
        build_import_text_label: 'Paste the JSON key',
        build_import_text_hint: 'A new build will be created with the specified version, loader, and mods from the key.',
        build_import_submit: 'Import',
        build_size: 'Size',
        build_exported: 'Build exported.',
        build_imported: 'Build imported.',
        build_configs_import: 'Configs',
        build_configs_imported: 'Build configs imported.'
    }
};

const categoryTranslations = {
    adventure: { Русский: 'Приключения', English: 'Adventure' },
    armor: { Русский: 'Броня', English: 'Armor' },
    combat: { Русский: 'Бой', English: 'Combat' },
    decoration: { Русский: 'Декор', English: 'Decoration' },
    economy: { Русский: 'Экономика', English: 'Economy' },
    equipment: { Русский: 'Снаряжение', English: 'Equipment' },
    food: { Русский: 'Еда', English: 'Food' },
    'game-mechanics': { Русский: 'Механики', English: 'Game Mechanics' },
    library: { Русский: 'Библиотеки', English: 'Libraries' },
    magic: { Русский: 'Магия', English: 'Magic' },
    management: { Русский: 'Управление', English: 'Management' },
    minigame: { Русский: 'Мини-игры', English: 'Minigame' },
    mobs: { Русский: 'Мобы', English: 'Mobs' },
    optimization: { Русский: 'Оптимизация', English: 'Optimization' },
    social: { Русский: 'Социальное', English: 'Social' },
    storage: { Русский: 'Хранилище', English: 'Storage' },
    technology: { Русский: 'Технологии', English: 'Technology' },
    transportation: { Русский: 'Транспорт', English: 'Transportation' },
    utility: { Русский: 'Утилиты', English: 'Utility' },
    worldgen: { Русский: 'Генерация мира', English: 'Worldgen' }
};

const refs = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheRefs();
    bindStaticEvents();
    bindWindowTransitions();
    bindSystemInfoEvents();
    applyMainTransition();
    initialize().catch((error) => {
        console.error(error);
        updateModsStatus(`${t('error_prefix')}: ${error.message}`);
    });
});

function cacheRefs() {
    refs.body = document.body;
    refs.main = document.querySelector('.main');
    refs.sidebar = document.querySelector('.sidebar');
    refs.sidebarNav = document.querySelector('.sidebar-nav');
    refs.sidebarSpacer = document.querySelector('.sidebar-spacer');
    refs.navIndicator = document.querySelector('.nav-indicator');
    refs.navItems = Array.from(document.querySelectorAll('.nav-item'));
    refs.panels = Array.from(document.querySelectorAll('.content-panel'));
    refs.accountCard = document.getElementById('account-card');
    refs.accountAvatar = document.getElementById('account-avatar');
    refs.accountName = document.getElementById('account-name');
    refs.toolbar = document.querySelector('.toolbar');
    refs.toolbarTitle = document.querySelector('.toolbar-title');
    refs.titleText = document.querySelector('.title-text');
    refs.searchToggle = document.querySelector('.search-toggle');
    refs.searchInput = document.getElementById('app-search');
    refs.searchClose = document.querySelector('.search-close');
    refs.controlButtons = Array.from(document.querySelectorAll('.control-btn'));
    refs.searchStatus = document.getElementById('mods-search-status');
    refs.modsResults = document.getElementById('mods-results');
    refs.modsPagination = document.getElementById('mods-pagination');
    refs.installedModsResults = document.getElementById('installed-mods-results');
    refs.installedModsPagination = document.getElementById('installed-mods-pagination');
    refs.modManagerStatus = document.getElementById('mod-manager-search-status');
    refs.modManagerFolderBtn = document.getElementById('mod-manager-folder-btn');
    refs.playSelectBtn = document.getElementById('play-select-btn');
    refs.playLaunchBtn = document.getElementById('play-launch-btn');
    refs.loaderShowcase = document.getElementById('loader-showcase');
    refs.launchStatusLabel = document.getElementById('launch-status-label');
    refs.launchStatusText = document.getElementById('launch-status-text');
    refs.playPickerOverlay = document.getElementById('play-picker-overlay');
    refs.playPickerClose = document.getElementById('play-picker-close');
    refs.playFilterVersion = document.getElementById('play-filter-version');
    refs.playFilterLoader = document.getElementById('play-filter-loader');
    refs.playPickerList = document.getElementById('play-picker-list');
    refs.modsFilterSelect = document.getElementById('mods-filter-select');
    refs.modsFolderBtn = document.getElementById('mods-folder-btn');
    refs.modsTypeToggle = document.getElementById('mods-type-toggle');
    refs.modsTypeLabel = document.getElementById('mods-type-label');
    refs.modsTypeModalOverlay = document.getElementById('mods-type-modal-overlay');
    refs.modsTypeModalClose = document.getElementById('mods-type-modal-close');
    refs.modsTypeGrid = document.getElementById('mods-type-grid');
    refs.buildsFolderBtn = document.getElementById('builds-folder-btn');
    refs.buildsList = document.getElementById('builds-list');
    refs.buildsCreateBtn = document.getElementById('builds-create-btn');
    refs.saveState = document.getElementById('save-state');
    refs.languageSelect = document.getElementById('setting-language');
    refs.memoryRange = document.getElementById('setting-memory');
    refs.memoryValue = document.getElementById('memory-value');
    refs.memoryHint = document.getElementById('memory-hint');
    refs.javaSelect = document.getElementById('setting-java');
    refs.selectJavaBtn = document.getElementById('select-java');
    refs.darkMenusToggle = document.getElementById('setting-dark-menus');
    refs.trayToggle = document.getElementById('setting-tray');
    refs.reopenLauncherToggle = document.getElementById('setting-reopen-launcher');
    refs.launcherVersionValue = document.getElementById('launcher-version-value');
    refs.githubTokenInput = document.getElementById('setting-github-token');
    refs.checkUpdatesBtn = document.getElementById('check-updates-btn');
    refs.applyUpdateBtn = document.getElementById('apply-update-btn');
    refs.updateStatusHint = document.getElementById('update-status-hint');
    refs.modalOverlay = document.getElementById('build-modal-overlay');
    refs.modalCloseBtn = document.getElementById('build-modal-close');
    refs.modalCancelBtn = document.getElementById('build-modal-cancel');
    refs.modalSaveBtn = document.getElementById('build-modal-save');
    refs.buildNameInput = document.getElementById('build-name-input');
    refs.buildVersionSelect = document.getElementById('build-version-select');
    refs.buildLoaderSelect = document.getElementById('build-loader-select');
    refs.accountModalOverlay = document.getElementById('account-modal-overlay');
    refs.accountModalClose = document.getElementById('account-modal-close');
    refs.accountModalSave = document.getElementById('account-modal-save');
    refs.accountList = document.getElementById('account-list');
    refs.accountNameInput = document.getElementById('account-name-input');
    refs.launchModalOverlay = document.getElementById('launch-modal-overlay');
    refs.launchModalClose = document.getElementById('launch-modal-close');
    refs.launchProgressTitle = document.getElementById('launch-progress-title');
    refs.launchProgressPercent = document.getElementById('launch-progress-percent');
    refs.launchProgressFill = document.getElementById('launch-progress-fill');
    refs.launchProgressDetail = document.getElementById('launch-progress-detail');
    refs.launchProgressSpeed = document.getElementById('launch-progress-speed');
    refs.launchCommandOutput = document.getElementById('launch-command-output');
    refs.launchReportOpenBtn = document.getElementById('launch-report-open-btn');
    refs.importModalOverlay = document.getElementById('build-import-modal-overlay');
    refs.importModalClose = document.getElementById('build-import-modal-close');
    refs.importTextarea = document.getElementById('build-import-textarea');
    refs.importModalSave = document.getElementById('build-import-modal-save');
    refs.dependencyModalOverlay = document.getElementById('dependency-modal-overlay');
    refs.dependencyModalClose = document.getElementById('dependency-modal-close');
    refs.dependencyModalCancel = document.getElementById('dependency-modal-cancel');
    refs.dependencyModalConfirm = document.getElementById('dependency-modal-confirm');
    refs.dependencyList = document.getElementById('dependency-list');
    refs.buildsImportBtn = document.getElementById('builds-import-btn');
    refs.buildsImportJsonBtn = document.getElementById('builds-import-json-btn');
    refs.buildsExportBtn = document.getElementById('builds-export-btn');
}

function bindWindowTransitions() {
    if (!window.launcherWindow?.onTransition || !refs.body) {
        return;
    }

    if (bindWindowTransitions.cleanup) {
        bindWindowTransitions.cleanup();
    }

    bindWindowTransitions.cleanup = window.launcherWindow.onTransition((payload) => {
        const type = String(payload?.type || '').toLowerCase();
        const durationMs = Math.max(120, Number(payload?.durationMs) || 280);

        refs.body.classList.remove('launcher-closing', 'launcher-opening');
        void refs.body.offsetWidth;

        if (type === 'closing') {
            refs.body.classList.add('launcher-closing');
        } else if (type === 'opening') {
            refs.body.classList.add('launcher-opening');
        } else {
            return;
        }

        window.clearTimeout(bindWindowTransitions.timer);
        bindWindowTransitions.timer = window.setTimeout(() => {
            refs.body?.classList.remove('launcher-closing', 'launcher-opening');
        }, durationMs + 80);
    });
}

function bindSystemInfoEvents() {
    if (!window.launcherSettings?.onJavaOptionsUpdated) {
        return;
    }

    bindSystemInfoEvents.cleanup?.();
    bindSystemInfoEvents.cleanup = window.launcherSettings.onJavaOptionsUpdated((payload) => {
        const javaOptions = Array.isArray(payload?.javaOptions) ? payload.javaOptions : [];
        if (!javaOptions.length) {
            return;
        }

        state.systemInfo.javaOptions = javaOptions;
        renderJavaOptions();
    });
}

async function initialize() {
    subscribeToGameStatus();
    // Try to use pre-loaded data from splash screen first
    const preloadedData = window.__krakvamclPreloadedData || {};
    let settings, systemInfo, buildsState, filters, buildOptions, installedState, gameState, preloadedAccounts;

    if (preloadedData.settings && preloadedData.systemInfo && preloadedData.buildsState) {
        // Use pre-loaded data from splash
        settings = preloadedData.settings;
        systemInfo = preloadedData.systemInfo;
        buildsState = preloadedData.buildsState;
        filters = preloadedData.filters;
        buildOptions = preloadedData.buildOptions;
        installedState = preloadedData.installedState;
        gameState = preloadedData.gameState;
        preloadedAccounts = preloadedData.accounts;
    } else {
        // Load data now (fallback if splash didn't pre-load)
        const loadResults = await Promise.all([
            window.launcherSettings.load(),
            window.launcherSettings.getSystemInfo(),
            window.launcherBuilds.list(),
            window.launcherMods.getFilters(),
            window.launcherBuilds.getOptions(),
            window.launcherMods.listInstalled(),
            window.launcherGame.getState()
        ]);
        [settings, systemInfo, buildsState, filters, buildOptions, installedState, gameState] = loadResults;
    }

    state.settings = { ...state.settings, ...settings };
    state.systemInfo = { ...state.systemInfo, ...systemInfo };
    state.updateInfo.currentVersion = systemInfo?.launcherVersion || state.updateInfo.currentVersion;
    

    state.builds = Array.isArray(buildsState?.builds)
    ? buildsState.builds
    : [];

    const preferredBuildId =
        buildsState?.activeBuildId ||
        state.settings.activeBuildId ||
        DEFAULT_BUILD_ID;

    const existingBuild = state.builds.find(b => b.id === preferredBuildId);

    state.activeBuildId = existingBuild
        ? existingBuild.id
        : state.builds[0]?.id || DEFAULT_BUILD_ID;

    state.settings.activeBuildId = state.activeBuildId;


    state.activeBuildId = buildsState?.activeBuildId || state.settings.activeBuildId || DEFAULT_BUILD_ID;
    state.modFilters = Array.isArray(filters) ? filters : [];
    state.buildOptions = {
        gameVersions: Array.isArray(buildOptions?.gameVersions) && buildOptions.gameVersions.length ? buildOptions.gameVersions : [DEFAULT_GAME_VERSION],
        loaders: Array.isArray(buildOptions?.loaders) && buildOptions.loaders.length ? buildOptions.loaders : ['vanilla', 'forge', 'fabric', 'neoforge']
    };
    state.installedMods = Array.isArray(installedState?.mods) ? installedState.mods : [];
    state.lastCrashReportPath = gameState?.latestCrashReportPath || '';

    if (preloadedAccounts?.accounts) {
        const storedAccounts = Array.isArray(preloadedAccounts.accounts)
            ? preloadedAccounts.accounts.filter((item) => item && String(item.name || '').trim())
            : getDefaultAccounts();

        state.accounts = (storedAccounts.length ? storedAccounts : getDefaultAccounts()).map((account) => ({
            ...account,
            type: account.type || 'regular'
        }));

        state.activeAccountId = storedAccounts.some((item) => item.id === preloadedAccounts.activeAccountId)
            ? preloadedAccounts.activeAccountId
            : state.accounts[0].id;

        persistAccountsState(false);
    } else {
        hydrateAccounts();
    }

    loadModsCache();

    hydrateSettingsControls();
    renderJavaOptions();
    renderBuildOptions();
    renderModFilters();
    renderPlayFilters();
    renderLoaderShowcase();
    applyLanguage();
    applyPlatformClasses();
    applyDarkMenus();
    renderBuilds();
    renderPlayPickerList();
    renderInstalledMods();
    renderModsResults();
    renderAccounts();
    updateToolbarTitle();
    updatePlayPanel();
    updateLaunchUi();
    updateNavIndicator();
    setSaveState('saved');

    if (state.settings.githubToken) {
        checkForUpdates(true)
            .then(async () => {
                if (state.updateInfo.updateAvailable) {
                    await applyLauncherUpdate();
                }
            })
            .catch(() => {
                updateUpdateUi();
            });
    } else {
        state.updateInfo.status = t('updates_status_missing_token');
        updateUpdateUi();
    }
}

async function checkForUpdates(silent = false) {
    if (!window.launcherUpdates?.check) {
        return;
    }

    const token = String(state.settings.githubToken || '').trim();
    if (!token) {
        state.updateInfo = {
            ...state.updateInfo,
            checking: false,
            updateAvailable: false,
            status: t('updates_status_missing_token')
        };
        updateUpdateUi();
        return;
    }

    state.updateInfo = {
        ...state.updateInfo,
        checking: true,
        status: t('updates_status_checking')
    };
    updateUpdateUi();

    try {
        const payload = await window.launcherUpdates.check({ token });
        state.updateInfo = {
            ...state.updateInfo,
            ...payload,
            checking: false,
            status: payload.updateAvailable
                ? t('updates_status_available').replace('{version}', payload.remoteVersion)
                : t('updates_status_latest')
        };
    } catch (error) {
        state.updateInfo = {
            ...state.updateInfo,
            checking: false,
            updateAvailable: false,
            status: silent ? t('updates_status_missing_token') : `${t('error_prefix')}: ${error.message}`
        };
    }

    updateUpdateUi();
}

async function applyLauncherUpdate() {
    if (!window.launcherUpdates?.apply) {
        return;
    }

    const token = String(state.settings.githubToken || '').trim();
    if (!token) {
        state.updateInfo.status = t('updates_status_missing_token');
        updateUpdateUi();
        return;
    }

    state.updateInfo = {
        ...state.updateInfo,
        checking: true,
        status: t('updates_status_applying')
    };
    updateUpdateUi();

    try {
        const payload = await window.launcherUpdates.apply({ token });
        state.updateInfo = {
            ...state.updateInfo,
            ...payload,
            checking: false,
            status: payload.relaunching ? t('updates_status_restart') : t('updates_status_latest')
        };
    } catch (error) {
        state.updateInfo = {
            ...state.updateInfo,
            checking: false,
            status: `${t('error_prefix')}: ${error.message}`
        };
    }

    updateUpdateUi();
}

function updateUpdateUi() {
    if (refs.launcherVersionValue) {
        refs.launcherVersionValue.textContent = state.updateInfo.currentVersion || state.systemInfo.launcherVersion || '0.1.0';
    }

    if (refs.updateStatusHint) {
        refs.updateStatusHint.textContent = state.updateInfo.status || t('updates_status_idle');
    }

    if (refs.checkUpdatesBtn) {
        refs.checkUpdatesBtn.textContent = t('updates_check');
        refs.checkUpdatesBtn.disabled = Boolean(state.updateInfo.checking);
    }

    if (refs.applyUpdateBtn) {
        refs.applyUpdateBtn.textContent = t('updates_apply');
        refs.applyUpdateBtn.disabled = Boolean(state.updateInfo.checking || !state.updateInfo.updateAvailable);
    }
}


function bindStaticEvents() {
    window.activateNavTab = (button) => {
        const view = button?.dataset?.view;
        if (view) {
            switchView(view);
        }
    };

    refs.searchToggle?.addEventListener('click', () => {
        refs.toolbar?.classList.add('search-open');
        refs.searchInput?.focus();
    });

    refs.searchClose?.addEventListener('click', closeSearch);
    refs.searchInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeSearch();
        }
    });

    refs.searchInput?.addEventListener('input', (event) => {
        state.modsQuery = event.target.value.trim();
        state.modsCurrentPage = 1;
        state.installedModsCurrentPage = 1;

        clearTimeout(state.searchDebounceTimer);
        state.searchDebounceTimer = setTimeout(() => {
            if (state.activeView === 'mods') {
                performModsSearch().catch((error) => {
                    console.error(error);
                    updateModsStatus(`${t('error_prefix')}: ${error.message}`);
                });
                return;
            }

            if (state.activeView === 'mod-manager') {
                renderInstalledMods();
                return;
            }

            if (state.activeView === 'settings' || state.activeView === 'news' || state.activeView === 'builds') {
                applyLocalSearch(state.activeView, state.modsQuery);
                return;
            }

            updateModsStatus(t('search_scope_hint'));
        }, 320);
    });

    refs.controlButtons.forEach((button) => {
        if (button.classList.contains('close')) {
            button.addEventListener('click', () => window.launcherWindow?.close?.());
            return;
        }

        button.addEventListener('click', () => {
            refs.body.classList.add('launcher-minimizing');
            window.clearTimeout(bindStaticEvents.minimizeTimer);
            bindStaticEvents.minimizeTimer = window.setTimeout(() => {
                refs.body.classList.remove('launcher-minimizing');
                window.launcherWindow?.minimize?.();
            }, 240);
        });
    });

    refs.modsFilterSelect?.addEventListener('change', async (event) => {
        state.modsCategory = event.target.value;
        state.modsCurrentPage = 1;
        await performModsSearch();
    });

    refs.playSelectBtn?.addEventListener('click', () => {
        openPlayPicker();
    });

    refs.playLaunchBtn?.addEventListener('click', () => {
        
        openLaunchModal();
        const activeAccount = getActiveAccount();
        window.launcherGame.launch({
            buildId: state.activeBuildId,
            accountName: activeAccount.name,
            accountType: activeAccount.type || 'regular'
        }).catch((error) => {
            state.launchStatus.title = t('error_prefix');
            state.launchStatus.detail = getReadableErrorMessage(error);
            updateLaunchUi();
        });
    });

    refs.accountCard?.addEventListener('click', () => {
        openAccountModal();
    });

    const openSidebar = () => refs.sidebar?.classList.add('sidebar-hovered');
    const closeSidebar = () => refs.sidebar?.classList.remove('sidebar-hovered');

    // Sidebar hover - expand when hovering over sidebar area or nav items
    [refs.sidebar, refs.sidebarNav, refs.sidebarSpacer, refs.accountCard, ...refs.navItems].forEach((element) => {
        element?.addEventListener('mouseenter', openSidebar);
        element?.addEventListener('mouseleave', closeSidebar);
    });
    
    refs.playPickerClose?.addEventListener('click', closePlayPicker);
    refs.playPickerOverlay?.addEventListener('click', (event) => {
        if (event.target === refs.playPickerOverlay) {
            closePlayPicker();
        }
    });

    refs.modsTypeToggle?.addEventListener('click', () => {
        refs.modsTypeModalOverlay.hidden = false;
    });

    refs.modsTypeModalClose?.addEventListener('click', () => {
        refs.modsTypeModalOverlay.hidden = true;
    });

    refs.modsTypeModalOverlay?.addEventListener('click', (event) => {
        if (event.target === refs.modsTypeModalOverlay) {
            refs.modsTypeModalOverlay.hidden = true;
        }
    });

    refs.modsTypeGrid?.querySelectorAll('[data-type]').forEach((button) => {
        button.addEventListener('click', async () => {
            const newType = button.getAttribute('data-type');
            if (newType && newType !== state.modsType) {
                state.modsType = newType;
                state.modsCurrentPage = 1;
                state.modsCategory = 'all';
                if (refs.modsTypeLabel) refs.modsTypeLabel.textContent = t(`mods_type_${newType}`);
                refs.modsTypeModalOverlay.hidden = true;

                // Перезагружаем фильтры для нового типа
                try {
                    const filters = await window.launcherMods.getFilters({ contentType: newType });
                    state.modFilters = Array.isArray(filters) ? filters : [];
                    renderModFilters();
                } catch (e) {
                    console.warn('Failed to load filters for type', newType, e);
                }

                renderModsResults();
                performModsSearch().catch((error) => {
                    console.error(error);
                    updateModsStatus(`${t('error_prefix')}: ${error.message}`);
                });
            }
        });
    });

    refs.playFilterVersion?.addEventListener('change', () => {
        state.playFilterVersion = refs.playFilterVersion.value;
        renderPlayPickerList();
    });

    refs.playFilterLoader?.addEventListener('change', () => {
        state.playFilterLoader = refs.playFilterLoader.value;
        renderPlayPickerList();
    });

    refs.modsFolderBtn?.addEventListener('click', async () => {
        try {
            await window.launcherMods.openFolder();
            updateModsStatus(t('mods_open_folder_success'));
        } catch (error) {
            updateModsStatus(`${t('error_prefix')}: ${error.message}`);
        }
    });

    refs.modManagerFolderBtn?.addEventListener('click', async () => {
        try {
            await window.launcherMods.openFolder();
            updateInstalledModsStatus(t('mods_open_folder_success'));
        } catch (error) {
            updateInstalledModsStatus(`${t('error_prefix')}: ${error.message}`);
        }
    });

    refs.buildsFolderBtn?.addEventListener('click', async () => {
        try {
            await window.launcherBuilds.openFolder();
            updateModsStatus(t('build_open_folder_success'));
        } catch (error) {
            updateModsStatus(`${t('error_prefix')}: ${error.message}`);
        }
    });

    refs.buildsCreateBtn?.addEventListener('click', () => openBuildModal('create'));
    refs.buildsImportBtn?.addEventListener('click', async () => {
        try {
            const imported = await window.launcherBuilds.importJson({});
            if (imported) {
                await refreshBuildsState();
                updateModsStatus(t('build_imported'));
            }
        } catch (error) {
            updateModsStatus(`${t('error_prefix')}: ${error.message}`);
        }
    });
    refs.buildsImportJsonBtn?.addEventListener('click', () => {
        refs.importModalOverlay.hidden = false;
        refs.importTextarea.value = '';
        refs.importTextarea.focus();
    });
    refs.buildsExportBtn?.addEventListener('click', async () => {
        try {
            const path = await window.launcherBuilds.export(state.activeBuildId);
            if (path) {
                updateModsStatus(`${t('build_exported')} ${path}`);
            }
        } catch (error) {
            updateModsStatus(`${t('error_prefix')}: ${error.message}`);
        }
    });
    refs.modalCloseBtn?.addEventListener('click', closeBuildModal);
    refs.modalCancelBtn?.addEventListener('click', closeBuildModal);
    refs.modalOverlay?.addEventListener('click', (event) => {
        if (event.target === refs.modalOverlay) {
            closeBuildModal();
        }
    });

    refs.modalSaveBtn?.addEventListener('click', async () => {
        await saveBuildFromModal();
    });

    refs.accountModalClose?.addEventListener('click', closeAccountModal);
    refs.accountModalOverlay?.addEventListener('click', (event) => {
        if (event.target === refs.accountModalOverlay) {
            closeAccountModal();
        }
    });
    refs.accountModalSave?.addEventListener('click', saveAccountFromModal);
    refs.accountNameInput?.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await saveAccountFromModal();
        }
    });

    refs.buildNameInput?.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await saveBuildFromModal();
        }
    });

    refs.launchModalClose?.addEventListener('click', closeLaunchModal);
    refs.launchModalOverlay?.addEventListener('click', (event) => {
        if (event.target === refs.launchModalOverlay) {
            closeLaunchModal();
        }
    });
    refs.launchCommandOutput?.addEventListener('click', () => {
        const expanded = refs.launchCommandOutput.classList.toggle('is-expanded');
        refs.launchCommandOutput.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
    refs.launchReportOpenBtn?.addEventListener('click', async () => {
        if (!state.lastCrashReportPath) {
            return;
        }

        try {
            await window.launcherMods.openReport(state.lastCrashReportPath);
        } catch (error) {
            updateModsStatus(`${t('error_prefix')}: ${error.message}`);
        }
    });

    refs.importModalClose?.addEventListener('click', closeImportModal);
    refs.importModalOverlay?.addEventListener('click', (event) => {
        if (event.target === refs.importModalOverlay) {
            closeImportModal();
        }
    });
    refs.importModalSave?.addEventListener('click', async () => {
        const jsonText = refs.importTextarea.value.trim();
        if (!jsonText) {
            refs.importTextarea.focus();
            return;
        }

        try {
            await window.launcherBuilds.importJson({ jsonText });
            closeImportModal();
            await refreshBuildsState();
            updateModsStatus(t('build_imported'));
        } catch (error) {
            updateModsStatus(`${t('error_prefix')}: ${error.message}`);
        }
    });

    refs.dependencyModalClose?.addEventListener('click', () => resolveDependencyPrompt(false));
    refs.dependencyModalCancel?.addEventListener('click', () => resolveDependencyPrompt(false));
    refs.dependencyModalConfirm?.addEventListener('click', () => resolveDependencyPrompt(true));
    refs.dependencyModalOverlay?.addEventListener('click', (event) => {
        if (event.target === refs.dependencyModalOverlay) {
            resolveDependencyPrompt(false);
        }
    });

    refs.languageSelect?.addEventListener('change', async (event) => {
        state.settings.language = event.target.value;
        applyLanguage();
        await persistSettings();
    });

    refs.memoryRange?.addEventListener('input', async (event) => {
        state.settings.memoryMb = Number(event.target.value);
        updateMemoryUi();
        await persistSettings();
    });

    refs.javaSelect?.addEventListener('change', async (event) => {
        state.settings.javaPath = event.target.value;
        await persistSettings();
    });

    refs.selectJavaBtn?.addEventListener('click', async () => {
        const selected = await window.launcherSettings.selectJava();

        if (!selected) {
            return;
        }

        if (!state.systemInfo.javaOptions.some((option) => option.value === selected)) {
            state.systemInfo.javaOptions.push({ value: selected, label: selected });
        }

        state.settings.javaPath = selected;
        renderJavaOptions();
        await persistSettings();
    });

    refs.darkMenusToggle?.addEventListener('change', async (event) => {
        state.settings.darkMenus = Boolean(event.target.checked);
        applyDarkMenus();
        await persistSettings();
    });

    refs.trayToggle?.addEventListener('change', async (event) => {
        state.settings.minimizeToTrayOnLaunch = Boolean(event.target.checked);
        await persistSettings();
    });

    refs.reopenLauncherToggle?.addEventListener('change', async (event) => {
        state.settings.reopenLauncherOnGameExit = Boolean(event.target.checked);
        await persistSettings();
    });

    refs.githubTokenInput?.addEventListener('change', async (event) => {
        state.settings.githubToken = event.target.value.trim();
        await persistSettings();
        await checkForUpdates(true);
    });

    refs.checkUpdatesBtn?.addEventListener('click', async () => {
        await checkForUpdates(false);
    });

    refs.applyUpdateBtn?.addEventListener('click', async () => {
        await applyLauncherUpdate();
    });

    document.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            refs.toolbar?.classList.add('search-open');
            refs.searchInput?.focus();
        }

        if (event.key === 'Escape') {
            if (refs.modalOverlay && !refs.modalOverlay.hidden) {
                closeBuildModal();
            }

            if (refs.playPickerOverlay && !refs.playPickerOverlay.hidden) {
                closePlayPicker();
            }

            if (refs.accountModalOverlay && !refs.accountModalOverlay.hidden) {
                closeAccountModal();
            }

            if (refs.launchModalOverlay && !refs.launchModalOverlay.hidden) {
                closeLaunchModal();
            }

            if (refs.importModalOverlay && !refs.importModalOverlay.hidden) {
                closeImportModal();
            }

            if (refs.dependencyModalOverlay && !refs.dependencyModalOverlay.hidden) {
                resolveDependencyPrompt(false);
            }

            if (refs.modsTypeModalOverlay && !refs.modsTypeModalOverlay.hidden) {
                refs.modsTypeModalOverlay.hidden = true;
            }
        }
    });

    window.addEventListener('resize', () => {
        updateNavIndicator();
    });
}

function applyMainTransition() {
    if (sessionStorage.getItem('main_transition') === 'expand') {
        refs.body?.classList.add('main-transition');
        sessionStorage.removeItem('main_transition');
    }
}

function closeSearch() {
    refs.toolbar?.classList.remove('search-open');
    refs.searchInput?.blur();
    // Сбрасываем поиск при закрытии
    state.modsQuery = '';
    state.modsCurrentPage = 1;
    state.installedModsCurrentPage = 1;
    if (refs.searchInput) {
        refs.searchInput.value = '';
    }
    
    // Обновляем соответствующую вкладку
    if (state.activeView === 'mods') {
        performModsSearch().catch(() => {});
    } else if (state.activeView === 'mod-manager') {
        renderInstalledMods();
    } else if (state.activeView === 'builds') {
        renderBuilds();
    }
}

class CustomList {
    constructor(container, options = {}) {
        this.container = container;
        this.items = options.items || [];
        this.selectedIndex = options.selectedIndex || 0;
        this.onSelect = options.onSelect || (() => {});
        this.onRender = options.onRender || (() => {});
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        this.container.classList.add('custom-list');

        this.items.forEach((item, index) => {
            const element = document.createElement('div');
            element.className = 'custom-list-item';
            if (index === this.selectedIndex) {
                element.classList.add('active');
            }
            if (item.disabled) {
                element.classList.add('disabled');
            }

            let html = '';
            if (item.icon) {
                html += `<div class="custom-list-item-icon">${item.icon}</div>`;
            }

            html += '<div class="custom-list-item-text">';
            html += `<div class="custom-list-item-label">${item.label}</div>`;
            if (item.hint) {
                html += `<div class="custom-list-item-hint">${item.hint}</div>`;
            }
            html += '</div>';

            if (item.badge) {
                html += `<div class="custom-list-item-badge">${item.badge}</div>`;
            }

            element.innerHTML = html;

            if (!item.disabled) {
                element.addEventListener('click', () => {
                    this.select(index);
                });
            }

            this.container.appendChild(element);
        });

        this.onRender();
    }

    select(index) {
        if (index >= 0 && index < this.items.length && !this.items[index].disabled) {
            this.selectedIndex = index;
            this.render();
            this.onSelect(this.items[index], index);
        }
    }

    getSelected() {
        return this.items[this.selectedIndex];
    }

    setItems(items) {
        this.items = items;
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, items.length - 1));
        this.render();
    }
}

function getDefaultAccounts() {
    return [{
        id: 'account-default',
        name: DEFAULT_ACCOUNT_NAME
    }];
}

function hydrateAccounts() {
    try {
        const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const accounts = Array.isArray(parsed?.accounts)
            ? parsed.accounts.filter((item) => item && String(item.name || '').trim())
            : getDefaultAccounts();
        // Ensure all accounts have a type field for backward compatibility
        state.accounts = (accounts.length ? accounts : getDefaultAccounts()).map((account) => ({
            ...account,
            type: account.type || 'regular'
        }));
        state.activeAccountId = accounts.some((item) => item.id === parsed?.activeAccountId)
            ? parsed.activeAccountId
            : state.accounts[0].id;
        persistAccountsState(false);
    } catch (error) {
        console.warn('Failed to restore accounts state', error);
        state.accounts = getDefaultAccounts().map((account) => ({
            ...account,
            type: account.type || 'regular'
        }));
        state.activeAccountId = state.accounts[0].id;
    }
}

function persistAccountsState(notify = true) {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify({
        accounts: state.accounts,
        activeAccountId: state.activeAccountId
    }));

    if (notify) {
        updateModsStatus(t('account_status_saved'));
    }
}

function loadModsCache() {
    try {
        const raw = localStorage.getItem(MODS_CACHE_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        state.modsCache = parsed?.modsCache || {};
        state.installedModsCache = parsed?.installedModsCache || {};
    } catch (error) {
        state.modsCache = {};
        state.installedModsCache = {};
    }
}

function persistModsCache() {
    try {
        localStorage.setItem(MODS_CACHE_STORAGE_KEY, JSON.stringify({
            modsCache: state.modsCache,
            installedModsCache: state.installedModsCache
        }));
    } catch (error) {
        console.warn('Unable to persist mods cache', error);
    }
}

function getCachedModsForBuild(buildId) {
    return state.modsCache[buildId] || null;
}

function cacheModsForBuild(buildId, query, page, results, total) {
    if (!buildId) {
        return;
    }

    state.modsCache[buildId] = {
        query,
        page,
        results,
        total,
        ts: Date.now()
    };
    persistModsCache();
}

function getCachedInstalledModsForBuild(buildId) {
    return state.installedModsCache[buildId] || null;
}

function cacheInstalledModsForBuild(buildId, mods) {
    if (!buildId) {
        return;
    }

    state.installedModsCache[buildId] = {
        mods,
        ts: Date.now()
    };
    persistModsCache();
}

function applyLocalSearch(viewType, query) {
    const normalizedQuery = normalizeKey(query || '');

    if (!normalizedQuery) {
        // Показываем всё если поиск пуст
        if (viewType === 'settings') {
            const blocks = document.querySelectorAll('.setting-block');
            blocks.forEach(b => b.style.display = 'flex');
        } else if (viewType === 'builds') {
            const cards = document.querySelectorAll('.build-card');
            cards.forEach(c => c.style.display = 'grid');
        } else if (viewType === 'news') {
            const newsItems = document.querySelectorAll('.news-item, .news-card');
            newsItems.forEach(item => item.style.display = '');
        }
        updateModsStatus('');
        return;
    }

    // Реализуем поиск в зависимости от вкладки
    if (viewType === 'settings') {
        const blocks = document.querySelectorAll('.setting-block');
        let visibleCount = 0;

        blocks.forEach((block) => {
            const text = normalizeKey(block.textContent || '');
            const isVisible = text.includes(normalizedQuery);
            block.style.display = isVisible ? 'flex' : 'none';
            if (isVisible) visibleCount++;
        });

        if (visibleCount === 0) {
            updateModsStatus('Нет результатов в настройках');
        } else {
            updateModsStatus(`Найдено элементов: ${visibleCount}`);
        }
    } else if (viewType === 'builds') {
        const cards = document.querySelectorAll('.build-card');
        let visibleCount = 0;

        cards.forEach((card) => {
            const text = normalizeKey(card.textContent || '');
            const isVisible = text.includes(normalizedQuery);
            card.style.display = isVisible ? 'grid' : 'none';
            if (isVisible) visibleCount++;
        });

        if (visibleCount === 0) {
            updateModsStatus('Сборки не найдены');
        } else {
            updateModsStatus(`Найдено сборок: ${visibleCount}`);
        }
    } else if (viewType === 'news') {
        const newsItems = document.querySelectorAll('.news-item, .news-card');
        let visibleCount = 0;

        newsItems.forEach((item) => {
            const text = normalizeKey(item.textContent || '');
            const isVisible = text.includes(normalizedQuery);
            item.style.display = isVisible ? '' : 'none';
            if (isVisible) visibleCount++;
        });

        if (visibleCount === 0) {
            updateModsStatus('Новости не найдены');
        } else {
            updateModsStatus(`Найдено новостей: ${visibleCount}`);
        }
    }
}

function switchView(view) {
    state.activeView = view;
    
    // Сбрасываем поиск при переходе на другую вкладку
    state.modsQuery = '';
    state.modsCurrentPage = 1;
    state.installedModsCurrentPage = 1;
    closeSearch();

    refs.navItems.forEach((item) => {
        item.classList.toggle('active', item.dataset.view === view);
    });

    refs.panels.forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.panel === view);
    });

    updateNavIndicator();
    updateToolbarTitle();

    if (view === 'mods') {
        const activeBuild = getActiveBuild();
        const cached = activeBuild ? getCachedModsForBuild(activeBuild.id) : null;

        if (cached && cached.query === state.modsQuery && cached.page === state.modsCurrentPage && Array.isArray(cached.results) && cached.results.length) {
            state.modsResults = cached.results;
            state.modsTotalCount = Number(cached.total || 0);
            renderModsResults();
            updateModsStatus(state.modsTotalCount
                ? `${state.modsTotalCount} • ${formatLoader(activeBuild.loader)} ${activeBuild.minecraftVersion}`
                : t('mods_search_empty'));
        }

        performModsSearch().catch((error) => {
            console.error(error);
            updateModsStatus(`${t('error_prefix')}: ${error.message}`);
        });
    }

    if (view === 'mod-manager') {
        const activeBuild = getActiveBuild();
        const cached = activeBuild ? getCachedInstalledModsForBuild(activeBuild.id) : null;

        if (cached && Array.isArray(cached.mods)) {
            state.installedMods = cached.mods;
            renderInstalledMods();
            updateInstalledModsStatus(`${getBuildDisplayName(activeBuild)} • ${state.installedMods.length}`);
        }

        refreshInstalledMods().catch((error) => {
            console.error(error);
            updateInstalledModsStatus(`${t('error_prefix')}: ${error.message}`);
        });
    }
}

function updateNavIndicator() {
    if (!refs.navIndicator || !refs.sidebarNav) {
        return;
    }

    const activeItem = refs.navItems.find((item) => item.classList.contains('active'));
    if (!activeItem) {
        refs.navIndicator.style.opacity = '0';
        return;
    }

    const navRect = refs.sidebarNav.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const offsetTop = itemRect.top - navRect.top;

    refs.navIndicator.style.opacity = '1';
    refs.navIndicator.style.height = `${itemRect.height}px`;
    refs.navIndicator.style.transform = `translateY(${offsetTop}px)`;
}

function t(key) {
    const dictionary = translations[state.settings.language] || translations[DEFAULT_LANGUAGE];
    return dictionary[key] || translations[DEFAULT_LANGUAGE][key] || key;
}

function formatLoader(loader) {
    const raw = String(loader || DEFAULT_LOADER).toLowerCase();

    if (raw === 'neoforge') {
        return 'NeoForge';
    }

    if (raw === 'optifine') {
        return 'OptiFine';
    }

    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatNumber(value) {
    return new Intl.NumberFormat(state.settings.language === 'English' ? 'en-US' : 'ru-RU').format(Number(value) || 0);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function hydrateSettingsControls() {
    refs.languageSelect.value = state.settings.language;
    refs.memoryRange.max = String(Math.max(8192, state.systemInfo.totalRamMb));
    refs.memoryRange.value = String(state.settings.memoryMb);
    refs.darkMenusToggle.checked = Boolean(state.settings.darkMenus);
    refs.trayToggle.checked = Boolean(state.settings.minimizeToTrayOnLaunch);
    refs.reopenLauncherToggle.checked = Boolean(state.settings.reopenLauncherOnGameExit);
    refs.githubTokenInput.value = state.settings.githubToken || '';
    refs.launcherVersionValue.textContent = state.systemInfo.launcherVersion || state.updateInfo.currentVersion;
    updateMemoryUi();
    updateUpdateUi();
}

function updateMemoryUi() {
    refs.memoryValue.textContent = `${state.settings.memoryMb} MB`;
    refs.memoryHint.textContent = `${t('memory_hint')} ${formatNumber(state.systemInfo.totalRamMb)} MB`;
}

function renderJavaOptions() {
    const options = state.systemInfo.javaOptions || [];
    refs.javaSelect.innerHTML = options
        .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
        .join('');

    refs.javaSelect.value = options.some((option) => option.value === state.settings.javaPath)
        ? state.settings.javaPath
        : 'auto';
}

function renderBuildOptions() {
    refs.buildVersionSelect.innerHTML = state.buildOptions.gameVersions
        .map((version) => `<option value="${escapeHtml(version)}">${escapeHtml(version)}</option>`)
        .join('');

    refs.buildLoaderSelect.innerHTML = state.buildOptions.loaders
        .map((loader) => `<option value="${escapeHtml(loader)}">${escapeHtml(formatLoader(loader))}</option>`)
        .join('');
}

function renderModFilters() {
    const filters = [{ value: 'all', label: t('all_filter') }, ...state.modFilters.filter((item) => item.value !== 'all')];
    refs.modsFilterSelect.innerHTML = filters
        .map((item) => {
            const label = item.value === 'all' ? t('all_filter') : translateCategory(item.label || item.value);
            return `<option value="${escapeHtml(item.value)}">${escapeHtml(label)}</option>`;
        })
        .join('');

    refs.modsFilterSelect.value = filters.some((item) => item.value === state.modsCategory) ? state.modsCategory : 'all';
}

function renderPlayFilters() {
    const versions = ['all', ...new Set(state.builds.map((build) => build.minecraftVersion).filter(Boolean))];
    const loaders = ['all', ...new Set(state.builds.map((build) => build.loader).filter(Boolean))];

    refs.playFilterVersion.innerHTML = versions.map((value) => {
        const label = value === 'all' ? t('play_filter_all_versions') : value;
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    }).join('');

    refs.playFilterLoader.innerHTML = loaders.map((value) => {
        const label = value === 'all' ? t('play_filter_all_loaders') : formatLoader(value);
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    }).join('');

    refs.playFilterVersion.value = versions.includes(state.playFilterVersion) ? state.playFilterVersion : 'all';
    refs.playFilterLoader.value = loaders.includes(state.playFilterLoader) ? state.playFilterLoader : 'all';
}

function translateCategory(value) {
    const lang = state.settings.language;
    const key = String(value || '').toLowerCase();
    return categoryTranslations[key]?.[lang] || value;
}

function applyLanguage() {
    document.querySelector('.nav-item[data-view="play"] .nav-label').textContent = t('nav_play');
    document.querySelector('.nav-item[data-view="mods"] .nav-label').textContent = t('nav_mods');
    document.querySelector('.nav-item[data-view="mod-manager"] .nav-label').textContent = t('nav_mod_manager');
    document.querySelector('.nav-item[data-view="builds"] .nav-label').textContent = t('nav_builds');
    document.querySelector('.nav-item[data-view="news"] .nav-label').textContent = t('nav_news');
    document.querySelector('.nav-item[data-view="settings"] .nav-label').textContent = t('nav_settings');

    document.getElementById('play-panel-label').textContent = t('play_label');
    document.getElementById('play-panel-copy').textContent = t('play_copy');
    document.getElementById('play-picker-label').textContent = t('play_picker_label');
    document.getElementById('play-picker-title').textContent = t('play_picker_title');
    document.getElementById('mods-panel-label').textContent = t('mods_label');
    refs.modsTypeLabel.textContent = t(`mods_type_${state.modsType}`);
    document.getElementById('mod-manager-panel-label').textContent = t('mod_manager_label');
    document.getElementById('builds-panel-label').textContent = t('builds_label');
    document.getElementById('news-panel-label').textContent = t('news_label');
    document.getElementById('settings-panel-label').textContent = t('settings_label');

    document.getElementById('mods-panel-title').textContent = t('mods_title');
    document.getElementById('mod-manager-panel-title').textContent = t('mod_manager_title');
    document.getElementById('builds-panel-title').textContent = t('builds_title');
    document.getElementById('news-panel-title').textContent = t('news_title');
    document.getElementById('news-panel-copy').textContent = t('news_copy');
    document.getElementById('settings-panel-title').textContent = t('settings_title');

    document.getElementById('mods-filter-label').textContent = t('mods_filter_label');
    refs.modsFolderBtn.setAttribute('aria-label', t('mods_folder_aria'));
    document.getElementById('mods-search-label').textContent = t('mods_search_label');
    document.getElementById('mod-manager-search-label').textContent = t('mod_manager_current_build');

    document.getElementById('build-modal-label').textContent = t('build_modal_label');
    document.getElementById('play-filter-version-label').textContent = t('play_filter_version_label');
    document.getElementById('play-filter-loader-label').textContent = t('play_filter_loader_label');
    document.getElementById('build-name-label').textContent = t('build_name_label');
    document.getElementById('build-version-label').textContent = t('build_version_label');
    document.getElementById('build-loader-label').textContent = t('build_loader_label');
    refs.buildNameInput.placeholder = t('build_name_placeholder');
    refs.modalCancelBtn.textContent = t('build_cancel');
    refs.modalSaveBtn.textContent = state.buildModalMode === 'create' ? t('build_create') : t('build_save');

    document.getElementById('language-label').textContent = t('language_label');
    document.getElementById('memory-label').textContent = t('memory_label');
    document.getElementById('java-label').textContent = t('java_label');
    refs.selectJavaBtn.textContent = t('java_select');
    document.getElementById('java-hint').textContent = t('java_hint');
    document.getElementById('dark-menus-label').textContent = t('dark_menus_label');
    document.getElementById('dark-menus-hint').textContent = t('dark_menus_hint');
    document.getElementById('tray-label').textContent = t('tray_label');
    document.getElementById('tray-hint').textContent = t('tray_hint');
    document.getElementById('reopen-launcher-label').textContent = t('reopen_launcher_label');
    document.getElementById('reopen-launcher-hint').textContent = t('reopen_launcher_hint');
    document.getElementById('launcher-version-label').textContent = t('launcher_version_label');
    document.getElementById('launcher-version-hint').textContent = t('launcher_version_hint');
    document.getElementById('github-token-label').textContent = t('github_token_label');
    document.getElementById('github-token-hint').textContent = t('github_token_hint');
    document.getElementById('update-status-label').textContent = t('updates_status_label');
    refs.githubTokenInput.placeholder = t('github_token_placeholder');
    document.getElementById('account-label').textContent = t('account_label');
    document.getElementById('account-modal-label').textContent = t('account_modal_label');
    document.getElementById('account-modal-title').textContent = t('account_modal_title');
    document.getElementById('account-editor-label').textContent = t('account_editor_label');
    document.getElementById('account-editor-hint').textContent = t('account_editor_hint');
    refs.accountNameInput.placeholder = t('account_name_placeholder');
    refs.launchStatusLabel.textContent = t('launch_status_label');
    document.getElementById('launch-modal-label').textContent = t('launch_modal_label');
    document.getElementById('launch-modal-title').textContent = t('launch_modal_title');
    refs.launchProgressTitle.textContent = state.launchStatus.title || t('launch_progress_title');
    document.getElementById('launch-command-label').textContent = t('launch_command_label');
    refs.launchReportOpenBtn.textContent = t('launch_open_report');
    refs.buildsImportJsonBtn.textContent = t('builds_import_json');
    refs.buildsImportBtn.textContent = t('builds_import');
    refs.buildsExportBtn.textContent = t('builds_export');
    document.getElementById('build-import-modal-label').textContent = t('build_import_modal_label');
    document.getElementById('build-import-modal-title').textContent = t('build_import_modal_title');
    document.getElementById('build-import-text-label').textContent = t('build_import_text_label');
    document.getElementById('build-import-text-hint').textContent = t('build_import_text_hint');
    refs.importModalSave.textContent = t('build_import_submit');
    document.getElementById('dependency-modal-label').textContent = t('dependency_modal_label');
    document.getElementById('dependency-modal-title').textContent = t('dependency_modal_title');
    document.getElementById('dependency-modal-text').textContent = t('dependency_modal_text');
    refs.dependencyModalCancel.textContent = t('dependency_modal_cancel');
    refs.dependencyModalConfirm.textContent = t('dependency_modal_confirm');

    refs.playSelectBtn.textContent = t('play_select');
    refs.playLaunchBtn.textContent = t('play_launch');
    refs.searchToggle.setAttribute('aria-label', t('toolbar_search_open'));
    refs.searchClose.setAttribute('aria-label', t('toolbar_search_close'));
    refs.searchInput.placeholder = t('toolbar_search_placeholder');
    refs.controlButtons[0]?.setAttribute('aria-label', t('control_minimize'));
    refs.controlButtons[1]?.setAttribute('aria-label', t('control_close'));
    refs.buildsCreateBtn.setAttribute('aria-label', t('builds_create_aria'));
    refs.buildsFolderBtn?.setAttribute('aria-label', t('build_folder_aria'));
    refs.modManagerFolderBtn?.setAttribute('aria-label', t('mods_folder_aria'));
    refs.modsFolderBtn?.setAttribute('aria-label', t('mods_folder_aria'));

    updateMemoryUi();
    updatePlayPanel();
    updateToolbarTitle();
    renderModFilters();
    renderPlayFilters();
    renderPlayPickerList();
    renderLoaderShowcase();
    renderInstalledMods();
    renderModsResults();
    renderBuilds();
    renderAccounts();
    updateLaunchUi();
    updateUpdateUi();
    updateSaveStateLabel();
}

function applyDarkMenus() {
    refs.body.classList.toggle('dark-menus', Boolean(state.settings.darkMenus));
}

function applyPlatformClasses() {
    if (!refs.body) {
        return;
    }

    refs.body.classList.toggle('platform-win', state.systemInfo.platform === 'win32');
    refs.body.classList.toggle('platform-mac', state.systemInfo.platform === 'darwin');
    refs.body.classList.toggle('platform-linux', state.systemInfo.platform === 'linux');
}

function getActiveBuild() {
    return state.builds.find((build) => build.id === state.activeBuildId) || state.builds[0] || {
        id: DEFAULT_BUILD_ID,
        name: t('default_build_name'),
        minecraftVersion: DEFAULT_GAME_VERSION,
        loader: DEFAULT_LOADER,
        isDefault: true,
        path: 'builds/Standart',
        modsPath: 'builds/Standart/mods'
    };
}

function getBuildDisplayName(build) {
    if (!build) return t('default_build_name');
    // Если есть явное имя — показываем его
    const name = String(build.name || '').trim();
    if (name && name !== 'Standart' && name !== 'Standard') return name;
    // Для дефолтной сборки без кастомного имени
    if (build.isDefault || build.id === DEFAULT_BUILD_ID) return t('default_build_name');
    return build.id;
}

function updateToolbarTitle() {
    const activeBuild = getActiveBuild();
    const currentTab = t(`nav_${String(state.activeView || '').replace(/-/g, '_')}`);
    const loaderStr = formatLoader(activeBuild.loader);
    const versionStr = activeBuild.minecraftVersion || DEFAULT_GAME_VERSION;
    const buildStr = getBuildDisplayName(activeBuild);
    const title = `${t('title_app')} - ${currentTab} | ${buildStr} | ${loaderStr} ${versionStr}`;

    refs.toolbarTitle?.classList.add('switching');
    refs.titleText.textContent = title;

    window.clearTimeout(updateToolbarTitle.timer);
    updateToolbarTitle.timer = window.setTimeout(() => {
        refs.toolbarTitle?.classList.remove('switching');
    }, 180);
}

function updatePlayPanel() {
    const activeBuild = getActiveBuild();
    document.getElementById('play-panel-title').textContent = `${getBuildDisplayName(activeBuild)} • ${formatLoader(activeBuild.loader)} ${activeBuild.minecraftVersion}`;
    refs.playSelectBtn.textContent = `${getBuildDisplayName(activeBuild)} • ${formatLoader(activeBuild.loader)} ${activeBuild.minecraftVersion}`;
    document.getElementById('play-panel-copy').textContent = `${t('play_copy')} ${getActiveAccount().name}`;
    renderLoaderShowcase();
}

function formatSpeed(bytesPerSecond) {
    const bytes = Number(bytesPerSecond) || 0;
    if (!bytes) {
        return '0 MB/s';
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB/s`;
    }

    return `${(bytes / 1024 / 1024).toFixed(2)} MB/s`;
}

function getReadableErrorMessage(error) {
    const raw = String(error?.message || error || '').trim();
    if (!raw) {
        return t('error_prefix');
    }

    const ipcPrefixMatch = raw.match(/Error invoking remote method '[^']+':\s*(.+)$/i);
    if (ipcPrefixMatch?.[1]) {
        return ipcPrefixMatch[1].trim();
    }

    return raw.replace(/^Error:\s*/i, '').trim();
}

function formatBytesCompact(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024 * 1024) {
        return `${Math.round(value / 1024)} KB`;
    }

    if (value < 1024 * 1024 * 1024) {
        return `${(value / 1024 / 1024).toFixed(1)} MB`;
    }

    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function subscribeToGameStatus() {
    if (!window.launcherGame?.onStatus) return;

    if (subscribeToGameStatus.cleanup) {
        subscribeToGameStatus.cleanup();
    }

    subscribeToGameStatus.cleanup = window.launcherGame.onStatus((payload = {}) => {
        state.launchStatus = {
            ...state.launchStatus,

            title:
                payload.title !== undefined
                    ? payload.title
                    : state.launchStatus.title,

            detail:
                payload.detail !== undefined
                    ? payload.detail
                    : state.launchStatus.detail,

            progress:
                typeof payload.progress === 'number'
                    ? payload.progress
                    : state.launchStatus.progress,

            speedBytes:
                typeof payload.speedBytes === 'number'
                    ? payload.speedBytes
                    : state.launchStatus.speedBytes,

            command:
                payload.command !== undefined
                    ? payload.command
                    : state.launchStatus.command
        };

        if (payload.reportPath) {
            state.lastCrashReportPath = payload.reportPath;
        }

        updateLaunchUi();
    });
}

function updateLaunchUi() {
    const pct = Math.max(0, Math.min(100, Math.round(state.launchStatus.progress || 0)));
    const detail = state.launchStatus.detail || t('launch_status_idle');
    const title = state.launchStatus.title || t('launch_progress_title');

    // Modal
    if (refs.launchProgressTitle) refs.launchProgressTitle.textContent = title;
    if (refs.launchProgressPercent) refs.launchProgressPercent.textContent = `${pct}%`;
    if (refs.launchProgressFill) refs.launchProgressFill.style.width = `${pct}%`;
    if (refs.launchProgressDetail) refs.launchProgressDetail.textContent = detail;
    if (refs.launchProgressSpeed) refs.launchProgressSpeed.textContent = formatSpeed(state.launchStatus.speedBytes || 0);
    if (refs.launchCommandOutput) {
        refs.launchCommandOutput.textContent = state.launchStatus.command || 'Пока пусто';
        refs.launchCommandOutput.title = state.launchStatus.command || 'Пока пусто';
    }
    if (refs.launchReportOpenBtn) refs.launchReportOpenBtn.disabled = !state.lastCrashReportPath;

    // Inline status bar on play panel
    if (refs.launchStatusLabel) refs.launchStatusLabel.textContent = title;
    if (refs.launchStatusText) refs.launchStatusText.textContent = detail;

    // Inline progress bar — ищем или создаём
    const inlineBar = document.getElementById('launch-status-inline');
    if (inlineBar) {
        let progressEl = inlineBar.querySelector('.launch-status-progress');
        if (!progressEl) {
            progressEl = document.createElement('div');
            progressEl.className = 'launch-status-progress';
            progressEl.innerHTML = '<div class="launch-status-progress-fill"></div>';
            inlineBar.appendChild(progressEl);
        }
        const fill = progressEl.querySelector('.launch-status-progress-fill');
        if (fill) fill.style.width = `${pct}%`;
        // Скрываем прогресс если 0% и нет активного действия
        progressEl.style.display = (pct > 0 || state.launchStatus.speedBytes > 0) ? 'block' : 'none';
    }
}

function openLaunchModal() {
    refs.launchModalOverlay.hidden = false;
    refs.launchCommandOutput.classList.remove('is-expanded');
    refs.launchCommandOutput.setAttribute('aria-expanded', 'false');
    updateLaunchUi();
}

function closeLaunchModal() {
    refs.launchModalOverlay.hidden = true;
}

function closeImportModal() {
    refs.importModalOverlay.hidden = true;
    refs.importTextarea.value = '';
}

function closeDependencyModal(restoreFocus = true) {
    refs.dependencyModalOverlay.hidden = true;
    if (restoreFocus) {
        refs.playLaunchBtn?.focus();
    }
}

function resolveDependencyPrompt(value) {
    if (typeof dependencyPromptResolver === 'function') {
        const resolver = dependencyPromptResolver;
        dependencyPromptResolver = null;
        closeDependencyModal(false);
        resolver(Boolean(value));
        return;
    }

    closeDependencyModal();
}

function promptInstallDependencies(dependencies = []) {
    refs.dependencyList.innerHTML = dependencies.map((dependency) => `
        <div class="dependency-item">
            <div class="dependency-item-main">
                <span class="dependency-item-title">${escapeHtml(dependency.title || dependency.projectId || 'Dependency')}</span>
                <span class="dependency-item-meta">${escapeHtml([dependency.versionName, dependency.author].filter(Boolean).join(' • ') || dependency.projectId || '')}</span>
            </div>
        </div>
    `).join('');

    refs.dependencyModalOverlay.hidden = false;
    refs.dependencyModalConfirm?.focus();

    return new Promise((resolve) => {
        dependencyPromptResolver = resolve;
    });
}

function getActiveAccount() {
    return state.accounts.find((account) => account.id === state.activeAccountId) || state.accounts[0] || getDefaultAccounts()[0];
}

function getAccountAvatarUrl(name) {
    return `https://mc-heads.net/avatar/${encodeURIComponent(name || DEFAULT_ACCOUNT_NAME)}/64`;
}

function updateModsStatus(message) {
    refs.searchStatus.textContent = message;
}

function updateInstalledModsStatus(message) {
    if (refs.modManagerStatus) {
        refs.modManagerStatus.textContent = message;
    }
}

function renderPagination(container, { currentPage, totalPages, onSelect }) {
    if (!container) {
        return;
    }

    if (!totalPages || totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    const pages = [];
    for (let page = 1; page <= totalPages; page += 1) {
        if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
            pages.push(page);
        } else if (pages[pages.length - 1] !== 'ellipsis') {
            pages.push('ellipsis');
        }
    }

    container.innerHTML = `
        <button class="secondary-button pagination-btn" type="button" data-page-nav="prev" ${currentPage <= 1 ? 'disabled' : ''}>${escapeHtml(t('pagination_prev'))}</button>
        <div class="pagination-pages">
            ${pages.map((page, idx) => page === 'ellipsis'
                ? `<button class="pagination-ellipsis-btn" type="button" data-ellipsis-index="${idx}">…</button>`
                : `<button class="pagination-page ${page === currentPage ? 'is-active' : ''}" type="button" data-page-number="${page}">${page}</button>`).join('')}
        </div>
        <button class="secondary-button pagination-btn" type="button" data-page-nav="next" ${currentPage >= totalPages ? 'disabled' : ''}>${escapeHtml(t('pagination_next'))}</button>
    `;

    container.querySelectorAll('[data-page-number]').forEach((button) => {
        button.addEventListener('click', () => onSelect(Number(button.getAttribute('data-page-number'))));
    });

    container.querySelector('[data-page-nav="prev"]')?.addEventListener('click', () => onSelect(currentPage - 1));
    container.querySelector('[data-page-nav="next"]')?.addEventListener('click', () => onSelect(currentPage + 1));
    
    container.querySelectorAll('[data-ellipsis-index]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ellipsisBtn = btn;
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'pagination-ellipsis-input-wrapper';
            const checkmark = '\u2713';
            inputWrapper.innerHTML = `
                <input class="pagination-ellipsis-input" type="number" min="1" max="${totalPages}" placeholder="${escapeHtml(t('pagination_page'))}">
                <button class="pagination-ellipsis-confirm" type="button" title="Confirm">${checkmark}</button>
            `;
            
            ellipsisBtn.replaceWith(inputWrapper);
            
            const input = inputWrapper.querySelector('.pagination-ellipsis-input');
            const confirmBtn = inputWrapper.querySelector('.pagination-ellipsis-confirm');
            
            input?.focus();
            
            const goToPage = () => {
                const page = Number(input?.value);
                if (page >= 1 && page <= totalPages && page !== currentPage) {
                    onSelect(page);
                }
            };
            
            confirmBtn?.addEventListener('click', goToPage);
            input?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    goToPage();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    renderPagination(container, { currentPage, totalPages, onSelect });
                }
            });
            input?.addEventListener('blur', () => {
                setTimeout(() => {
                    renderPagination(container, { currentPage, totalPages, onSelect });
                }, 150);
            });
        });
    });
}

function getInstalledModMatch(mod) {
    const projectId = String(mod.id || '');
    const normalizedTitle = normalizeKey(mod.title || '');
    return state.installedMods.find((installed) => {
        return (installed.projectId && String(installed.projectId) === projectId)
            || (installed.normalizedName && installed.normalizedName === normalizedTitle);
    }) || null;
}

function normalizeKey(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\.jar(?:\.disabled)?$/i, '')
        .replace(/[^a-z0-9]+/g, '');
}

function getInstalledModCachedIcon(mod) {
    const projectId = String(mod?.projectId || '');
    if (projectId && state.installedModIcons[projectId]) {
        return state.installedModIcons[projectId];
    }

    const matchedSearchResult = state.modsResults.find((entry) => {
        return String(entry?.id || '') === projectId
            || normalizeKey(entry?.title || '') === normalizeKey(mod?.title || mod?.filename || '');
    });

    return matchedSearchResult?.iconUrl || '';
}

function getInstalledModCoverMarkup(mod) {
    const iconUrl = getInstalledModCachedIcon(mod);
    const fallbackLetter = escapeHtml((mod.title || mod.filename || '?').charAt(0).toUpperCase());

    return `
        <img
            class="mods-result-cover"
            src="${escapeHtml(iconUrl || '')}"
            alt="${escapeHtml(mod.title || mod.filename || 'Mod')}"
            ${iconUrl ? '' : 'hidden'}
        >
        <div class="mods-result-cover mods-result-cover--fallback" ${iconUrl ? 'hidden' : ''}>${fallbackLetter}</div>
    `;
}

async function preloadInstalledModIcons(mods = []) {
    const targets = mods.filter((mod) => mod?.projectId && !state.installedModIcons[mod.projectId] && !state.installedModIconRequests[mod.projectId]);

    if (!targets.length) {
        return;
    }

    await Promise.all(targets.map(async (mod) => {
        const projectId = String(mod.projectId || '');
        if (!projectId) {
            return;
        }

        state.installedModIconRequests[projectId] = true;

        try {
            const response = await fetch(`https://api.modrinth.com/v2/project/${encodeURIComponent(projectId)}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const payload = await response.json();
            if (payload?.icon_url) {
                state.installedModIcons[projectId] = payload.icon_url;
            }
        } catch (error) {
            console.warn('Failed to load installed mod icon', projectId, error);
        } finally {
            delete state.installedModIconRequests[projectId];
        }
    }));

    if (state.activeView === 'mod-manager') {
        renderInstalledMods();
    }
}

async function refreshInstalledMods() {
    const activeBuild = getActiveBuild();
    const cached = activeBuild ? getCachedInstalledModsForBuild(activeBuild.id) : null;

    if (cached && Array.isArray(cached.mods)) {
        state.installedMods = cached.mods;
        const totalPages = Math.max(1, Math.ceil(state.installedMods.length / INSTALLED_MODS_PAGE_SIZE));
        state.installedModsCurrentPage = Math.min(state.installedModsCurrentPage, totalPages);
        renderInstalledMods();
        updateInstalledModsStatus(`${getBuildDisplayName(activeBuild)} • ${state.installedMods.length}`);
    }

const installedState = await window.launcherMods.listInstalled(
    state.activeBuildId
);
    state.installedMods = Array.isArray(installedState?.mods) ? installedState.mods : [];
    cacheInstalledModsForBuild(activeBuild?.id, state.installedMods);
    const totalPages = Math.max(1, Math.ceil(state.installedMods.length / INSTALLED_MODS_PAGE_SIZE));
    state.installedModsCurrentPage = Math.min(state.installedModsCurrentPage, totalPages);
    renderInstalledMods();
    updateInstalledModsStatus(`${getBuildDisplayName(activeBuild)} • ${state.installedMods.length}`);
}

async function toggleInstalledMod(filename) {
    const installedState = await window.launcherMods.listInstalled(
    state.activeBuildId
);
    state.installedMods = Array.isArray(installedState?.mods) ? installedState.mods : [];
    renderInstalledMods();
    renderModsResults();
    updateInstalledModsStatus(t('mods_toggled'));
    updateModsStatus(t('mods_toggled'));
}

async function deleteInstalledMod(filename) {
    const installedState = await window.launcherMods.deleteInstalled({ filename });
    state.installedMods = Array.isArray(installedState?.mods) ? installedState.mods : [];
    renderInstalledMods();
    renderModsResults();
    updateInstalledModsStatus(t('mods_deleted'));
    updateModsStatus(t('mods_deleted'));
}

async function performModsSearch(retryCount = 0) {
    if (state.activeView !== 'mods') {
        return;
    }

    const activeBuild = getActiveBuild();
    const contentType = state.modsType || 'mods';

    state.isSearchingMods = true;
    updateModsStatus(`${t('mods_search_loading')} ${formatLoader(activeBuild.loader)} ${activeBuild.minecraftVersion}`);

    try {
        const results = await window.launcherMods.search({
            query: state.modsQuery,
            category: state.modsCategory,
            gameVersion: activeBuild.minecraftVersion,
            loader: activeBuild.loader,
            page: state.modsCurrentPage,
            limit: MODS_PAGE_SIZE,
            contentType
        });

        state.modsResults = Array.isArray(results?.items) ? results.items : [];
        state.modsTotalCount = Number(results?.total || 0);
        
        if (state.modsResults.length === 0 && state.modsTotalCount === 0 && !state.modsQuery && retryCount === 0) {
            state.isSearchingMods = false;
            await new Promise(resolve => setTimeout(resolve, 300));
            return performModsSearch(1);
        }
        
        cacheModsForBuild(`${activeBuild.id}_${contentType}`, state.modsQuery, state.modsCurrentPage, state.modsResults, state.modsTotalCount);
        renderModsResults();
        updateModsStatus(state.modsTotalCount ? `${state.modsTotalCount} • ${formatLoader(activeBuild.loader)} ${activeBuild.minecraftVersion}` : t('mods_search_empty'));
    } catch (error) {
        state.modsResults = [];
        state.modsTotalCount = 0;
        renderModsResults();
        updateModsStatus(`${t('mods_search_error')} ${error.message}`);
    } finally {
        state.isSearchingMods = false;
    }
}

function renderModsResults() {
    if (!refs.modsResults) {
        return;
    }

    if (!state.modsResults.length) {
        refs.modsResults.innerHTML = `
            <div class="mods-empty-state">
                <div class="mods-empty-title">${escapeHtml(state.modsQuery ? t('mods_no_results_title') : t('mods_empty_title'))}</div>
                <div class="mods-empty-copy">${escapeHtml(state.modsQuery ? t('mods_no_results_copy') : t('mods_empty_copy'))}</div>
            </div>
        `;
        renderPagination(refs.modsPagination, { currentPage: 1, totalPages: 1, onSelect: () => {} });
        return;
    }

    refs.modsResults.innerHTML = state.modsResults.map((mod) => {
        const contentType = state.modsType || 'mods';
        const isMods = contentType === 'mods';
        const installedMatch = isMods ? getInstalledModMatch(mod) : null;
        const cover = mod.iconUrl
            ? `<img class="mods-result-cover" src="${escapeHtml(mod.iconUrl)}" alt="${escapeHtml(mod.title)}">`
            : `<div class="mods-result-cover mods-result-cover--fallback">${escapeHtml((mod.title || '?').charAt(0).toUpperCase())}</div>`;
        const tags = (mod.categories || []).slice(0, 3).map((tag) => `<span class="mods-result-tag">${escapeHtml(translateCategory(tag))}</span>`).join('');
        const installDisabled = installedMatch ? 'disabled' : '';
        const installButtonContent = installedMatch
            ? `<img src="assets/icons/check_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.png" alt="${escapeHtml(t('mods_installed'))}">`
            : escapeHtml(t('mods_install'));
        const installButtonClass = installedMatch ? 'mods-install-btn mods-install-btn--installed icon-only' : 'mods-install-btn';
        const installButtonAria = installedMatch ? `aria-label="${escapeHtml(t('mods_installed'))}"` : '';
        const quickActions = installedMatch ? `
            <button class="mods-install-btn" type="button" data-toggle-installed="${escapeHtml(installedMatch.filename)}">${escapeHtml(installedMatch.enabled ? t('mods_disable') : t('mods_enable'))}</button>
            <button class="mods-install-btn is-danger icon-only" type="button" data-delete-installed="${escapeHtml(installedMatch.filename)}" aria-label="${escapeHtml(t('mods_delete'))}"><img src="assets/icons/delete_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.png" alt=""></button>
        ` : '';

        return `
            <article class="mods-result-card" data-mod-id="${escapeHtml(mod.id)}">
                ${cover}
                <div class="mods-result-body">
                    <div class="mods-result-head">
                        <div>
                            <div class="mods-result-title-row">
                                <h3 class="mods-result-title">${escapeHtml(mod.title)}</h3>
                            </div>
                            <div class="mods-result-meta">${escapeHtml(t('mods_author'))}: ${escapeHtml(mod.author || t('unknown_author'))}</div>
                        </div>
                        <div class="mods-result-actions">
                            <button class="${installButtonClass}" type="button" data-install-mod="${escapeHtml(mod.id)}" ${installDisabled} ${installButtonAria}>${installButtonContent}</button>
                            ${quickActions}
                        </div>
                    </div>
                    <p class="mods-result-summary">${escapeHtml(mod.summary || '')}</p>
                    <div class="mods-result-footer">
                        <div class="mods-result-tags">
                            ${tags}
                            <span class="mods-result-badge">${escapeHtml(t('mods_downloads'))}: ${escapeHtml(formatNumber(mod.downloads))}</span>
                            ${installedMatch ? `<span class="mods-result-badge ${installedMatch.enabled ? '' : 'mods-result-badge--success'}">${escapeHtml(installedMatch.enabled ? t('mods_detected_badge') : t('mods_disabled_badge'))}</span>` : ''}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    refs.modsResults.querySelectorAll('[data-install-mod]').forEach((button) => {
        button.addEventListener('click', async () => {
            const modId = button.getAttribute('data-install-mod');
            const activeBuild = getActiveBuild();
            const contentType = state.modsType || 'mods';
            const modEntry = state.modsResults.find((entry) => entry.id === modId);

            button.disabled = true;
            button.textContent = t('mods_installing');

            try {
                const result = await window.launcherMods.download({
                    modId,
                    gameVersion: activeBuild.minecraftVersion,
                    loader: activeBuild.loader,
                    title: modEntry?.title || '',
                    author: modEntry?.author || '',
                    contentType
                });

                if (contentType === 'mods') {
                    state.installedMods = Array.isArray(result?.installedMods?.mods) ? result.installedMods.mods : state.installedMods;
                }

                button.textContent = t('mods_installed');
                button.classList.add('mods-result-badge--success');
                updateModsStatus(`${t('mods_installed_to')}: ${getBuildDisplayName(activeBuild)}.`);

                if (Array.isArray(result?.missingDependencies) && result.missingDependencies.length) {
                    const confirmed = await promptInstallDependencies(result.missingDependencies);

                    if (confirmed) {
                        const installedState = await window.launcherMods.installDependencies({
                            dependencies: result.missingDependencies
                        });
                        state.installedMods = Array.isArray(installedState?.mods) ? installedState.mods : state.installedMods;
                        updateModsStatus(t('mods_dependency_installed'));
                    }
                }

                renderInstalledMods();
                renderModsResults();
            } catch (error) {
                button.disabled = false;
                button.textContent = t('mods_install');
                updateModsStatus(`${t('error_prefix')}: ${error.message}`);
            }
        });
    });

    refs.modsResults.querySelectorAll('[data-toggle-installed]').forEach((button) => {
        button.addEventListener('click', async () => {
            button.disabled = true;
            try {
                await toggleInstalledMod(button.getAttribute('data-toggle-installed'));
            } catch (error) {
                updateModsStatus(`${t('error_prefix')}: ${error.message}`);
            } finally {
                button.disabled = false;
            }
        });
    });

    refs.modsResults.querySelectorAll('[data-delete-installed]').forEach((button) => {
        button.addEventListener('click', async () => {
            button.disabled = true;
            try {
                await deleteInstalledMod(button.getAttribute('data-delete-installed'));
            } catch (error) {
                updateModsStatus(`${t('error_prefix')}: ${error.message}`);
            } finally {
                button.disabled = false;
            }
        });
    });

    const totalPages = Math.max(1, Math.ceil(state.modsTotalCount / MODS_PAGE_SIZE));
    renderPagination(refs.modsPagination, {
        currentPage: state.modsCurrentPage,
        totalPages,
        onSelect: async (page) => {
            state.modsCurrentPage = page;
            await performModsSearch();
        }
    });
}

function renderInstalledMods() {
    if (!refs.installedModsResults) {
        return;
    }

    const normalizedQuery = normalizeKey(state.modsQuery || '');
    const filteredInstalledMods = !normalizedQuery
        ? state.installedMods
        : state.installedMods.filter((mod) => {
            const haystack = [
                mod.title,
                mod.filename,
                mod.author,
                mod.projectId
            ].map((value) => normalizeKey(value || '')).join(' ');

            return haystack.includes(normalizedQuery);
        });

    if (!filteredInstalledMods.length) {
        refs.installedModsResults.innerHTML = `
            <div class="mods-empty-state">
                <div class="mods-empty-title">${escapeHtml(state.modsQuery ? t('mods_no_results_title') : t('mod_manager_title'))}</div>
                <div class="mods-empty-copy">${escapeHtml(state.modsQuery ? t('mods_no_results_copy') : t('mod_manager_empty'))}</div>
            </div>
        `;
        renderPagination(refs.installedModsPagination, { currentPage: 1, totalPages: 1, onSelect: () => {} });
        updateInstalledModsStatus(state.modsQuery
            ? `${t('mods_search_empty')} • ${getBuildDisplayName(getActiveBuild())}`
            : `${getBuildDisplayName(getActiveBuild())} • 0`);
        return;
    }

    const totalPages = Math.max(1, Math.ceil(filteredInstalledMods.length / INSTALLED_MODS_PAGE_SIZE));
    const safePage = Math.min(state.installedModsCurrentPage, totalPages);
    const pageItems = filteredInstalledMods.slice((safePage - 1) * INSTALLED_MODS_PAGE_SIZE, safePage * INSTALLED_MODS_PAGE_SIZE);

    refs.installedModsResults.innerHTML = pageItems.map((mod) => `
        <article class="mods-result-card">
            ${getInstalledModCoverMarkup(mod)}
            <div class="mods-result-body">
                <div class="mods-result-head">
                    <div>
                        <div class="mods-result-title-row">
                            <h3 class="mods-result-title">${escapeHtml(mod.title || mod.filename)}</h3>
                        </div>
                        <div class="mods-result-meta">${escapeHtml(mod.filename)}</div>
                    </div>
                    <div class="mods-result-actions">
                        <button class="mods-install-btn" type="button" data-manager-toggle="${escapeHtml(mod.filename)}">${escapeHtml(mod.enabled ? t('mods_disable') : t('mods_enable'))}</button>
                        <button class="mods-install-btn is-danger icon-only" type="button" data-manager-delete="${escapeHtml(mod.filename)}" aria-label="${escapeHtml(t('mods_delete'))}"><img src="assets/icons/delete_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.png" alt=""></button>                    </div>
                </div>
                <div class="mods-result-footer">
                    <div class="mods-result-tags">
                        <span class="mods-result-badge">${escapeHtml(mod.enabled ? t('mods_enabled_badge') : t('mods_disabled_badge'))}</span>
                        ${mod.author ? `<span class="mods-result-tag">${escapeHtml(mod.author)}</span>` : ''}
                    </div>
                </div>
            </div>
        </article>
    `).join('');

    // Use event delegation for better performance
    if (!refs.installedModsResults.__krakvamclInstalledModHandlerBound) {
        refs.installedModsResults.addEventListener('click', async (event) => {
            const toggleBtn = event.target.closest('[data-manager-toggle]');
            const deleteBtn = event.target.closest('[data-manager-delete]');

            if (toggleBtn) {
                try {
                    await toggleInstalledMod(toggleBtn.getAttribute('data-manager-toggle'));
                } catch (error) {
                    updateInstalledModsStatus(`${t('error_prefix')}: ${error.message}`);
                }
            } else if (deleteBtn) {
                try {
                    await deleteInstalledMod(deleteBtn.getAttribute('data-manager-delete'));
                } catch (error) {
                    updateInstalledModsStatus(`${t('error_prefix')}: ${error.message}`);
                }
            }
        });
        refs.installedModsResults.__krakvamclInstalledModHandlerBound = true;
    }

    renderPagination(refs.installedModsPagination, {
        currentPage: safePage,
        totalPages,
        onSelect: (page) => {
            state.installedModsCurrentPage = page;
            renderInstalledMods();
        }
    });

    updateInstalledModsStatus(state.modsQuery
        ? `${filteredInstalledMods.length} • ${getBuildDisplayName(getActiveBuild())}`
        : `${getBuildDisplayName(getActiveBuild())} • ${filteredInstalledMods.length}`);

    // Defer icon preloading to next frame to avoid blocking UI
    window.requestAnimationFrame(() => {
        void preloadInstalledModIcons(pageItems);
    });
}

function renderBuilds() {
    if (!refs.buildsList) {
        return;
    }

    const builds = state.builds || [];
    if (!builds.length) {
        refs.buildsList.innerHTML = `
            <div class="builds-empty-state">
                <div class="mods-empty-title">${escapeHtml(t('builds_empty_title'))}</div>
                <div class="mods-empty-copy">${escapeHtml(t('builds_empty_copy'))}</div>
            </div>
        `;
        return;
    }

    refs.buildsList.innerHTML = builds.map((build) => {
        const isActive = build.id === state.activeBuildId;
        const pills = [
            `<span class="build-pill">${escapeHtml(formatLoader(build.loader))}</span>`,
            `<span class="build-pill">${escapeHtml(build.minecraftVersion)}</span>`,
            `<span class="build-pill">${escapeHtml(t('build_size'))}: ${escapeHtml(formatBytesCompact(build.sizeBytes || 0))}</span>`,
            build.isDefault ? `<span class="build-pill build-pill--default">${escapeHtml(t('build_default'))}</span>` : '',
            isActive ? `<span class="build-pill build-pill--accent">${escapeHtml(t('build_active'))}</span>` : ''
        ].filter(Boolean).join('');

        return `
            <article class="build-card ${isActive ? 'is-active' : ''}" data-build-id="${escapeHtml(build.id)}">
                <div class="build-card-main">
                    <div class="build-card-head">
                        <h3 class="build-card-name">${escapeHtml(getBuildDisplayName(build))}</h3>
                    </div>
                    <div class="build-card-meta">${pills}</div>
                    <div class="build-card-footer">
                        <span class="build-card-path">${escapeHtml(t('build_path'))}: ${escapeHtml(build.path || '')}</span>
                    </div>
                </div>
                <div class="build-card-actions">
                    <button class="build-action-btn" type="button" data-action="configs" data-build-id="${escapeHtml(build.id)}" aria-label="${escapeHtml(t('build_configs_import'))}">
                        CFG
                    </button>
                    <button class="build-action-btn" type="button" data-action="edit" data-build-id="${escapeHtml(build.id)}" aria-label="${escapeHtml(t('build_edit_aria'))}">
                        <img src="assets/icons/edit_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.png" alt="">
                    </button>
                    <button class="build-action-btn is-danger" type="button" data-action="delete" data-build-id="${escapeHtml(build.id)}" aria-label="${escapeHtml(t('build_delete_aria'))}" ${build.isDefault ? 'disabled' : ''}>
                        <img src="assets/icons/delete_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.png" alt="">
                    </button>
                </div>
            </article>
        `;
    }).join('');

    refs.buildsList.querySelectorAll('.build-card').forEach((card) => {
        card.addEventListener('click', async (event) => {
            const actionButton = event.target.closest('.build-action-btn');
            const buildId = card.getAttribute('data-build-id');

            if (actionButton) {
                return;
            }

            if (buildId && buildId !== state.activeBuildId) {
                await setActiveBuild(buildId);
            }
        });
    });

    refs.buildsList.querySelectorAll('[data-action="edit"]').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const build = state.builds.find((item) => item.id === button.getAttribute('data-build-id'));
            if (build) {
                openBuildModal('edit', build);
            }
        });
    });

    refs.buildsList.querySelectorAll('[data-action="configs"]').forEach((button) => {
        button.addEventListener('click', async (event) => {
            event.stopPropagation();
            try {
                const result = await window.launcherBuilds.importConfigs(button.getAttribute('data-build-id'));
                if (result) {
                    updateModsStatus(t('build_configs_imported'));
                }
            } catch (error) {
                updateModsStatus(`${t('error_prefix')}: ${error.message}`);
            }
        });
    });

    refs.buildsList.querySelectorAll('[data-action="delete"]').forEach((button) => {
        button.addEventListener('click', async (event) => {
            event.stopPropagation();
            const buildId = button.getAttribute('data-build-id');
            await deleteBuild(buildId);
        });
    });
}

function getFilteredPlayBuilds() {
    return state.builds.filter((build) => {
        const versionOk = state.playFilterVersion === 'all' || build.minecraftVersion === state.playFilterVersion;
        const loaderOk = state.playFilterLoader === 'all' || build.loader === state.playFilterLoader;
        return versionOk && loaderOk;
    });
}

function renderPlayPickerList() {
    if (!refs.playPickerList) {
        return;
    }

    const builds = getFilteredPlayBuilds();

    if (!builds.length) {
        refs.playPickerList.innerHTML = `<div class="play-picker-empty">${escapeHtml(t('play_picker_empty'))}</div>`;
        return;
    }

    refs.playPickerList.innerHTML = builds.map((build) => {
        const isActive = build.id === state.activeBuildId;

        return `
            <button class="play-picker-item ${isActive ? 'is-active' : ''}" type="button" data-play-build-id="${escapeHtml(build.id)}">
                <div class="play-picker-item-main">
                    <h3 class="play-picker-item-title">${escapeHtml(getBuildDisplayName(build))}</h3>
                    <div class="play-picker-item-meta">
                        <span class="build-pill">${escapeHtml(formatLoader(build.loader))}</span>
                        <span class="build-pill">${escapeHtml(build.minecraftVersion)}</span>
                        ${build.isDefault ? `<span class="build-pill build-pill--default">${escapeHtml(t('build_default'))}</span>` : ''}
                        ${isActive ? `<span class="build-pill build-pill--accent">${escapeHtml(t('build_active'))}</span>` : ''}
                    </div>
                </div>
                <span class="build-pill build-pill--accent">${escapeHtml(t('play_pick_use'))}</span>
            </button>
        `;
    }).join('');

    refs.playPickerList.querySelectorAll('[data-play-build-id]').forEach((button) => {
        button.addEventListener('click', async () => {
            const buildId = button.getAttribute('data-play-build-id');
            await setActiveBuild(buildId);
            closePlayPicker();
        });
    });
}

function renderLoaderShowcase() {
    if (!refs.loaderShowcase) {
        return;
    }

    const activeBuild = getActiveBuild();
    const options = state.buildOptions.loaders.map((loader) => {
        const matchingBuild = state.builds.find((build) => build.loader === loader);
        const actionLabel = matchingBuild ? t('play_loader_action_open') : t('play_loader_action_create');
        const summary = matchingBuild
            ? `${getBuildDisplayName(matchingBuild)} • ${matchingBuild.minecraftVersion}`
            : actionLabel;

        return `<option value="${escapeHtml(loader)}" ${loader === activeBuild.loader ? 'selected' : ''}>${escapeHtml(formatLoader(loader))} • ${escapeHtml(summary)}</option>`;
    }).join('');

    refs.loaderShowcase.innerHTML = `
        <div class="loader-showcase-head">
            <span class="loader-showcase-title">${escapeHtml(t('play_loaders_title'))}</span>
            <span class="loader-showcase-copy">${escapeHtml(t('play_loaders_copy'))}</span>
        </div>
        <label class="loader-select-shell" for="play-loader-select">
            <span class="mods-filter-label">${escapeHtml(t('loader_label'))}</span>
            <select id="play-loader-select" class="loader-select">
                ${options}
            </select>
        </label>
    `;

    refs.loaderShowcase.querySelector('#play-loader-select')?.addEventListener('change', async (event) => {
        const loader = event.target.value;
        const matchingBuild = state.builds.find((build) => build.loader === loader);

        if (matchingBuild) {
            await setActiveBuild(matchingBuild.id);
            return;
        }

        openBuildModal('create', {
            name: '',
            minecraftVersion: getActiveBuild().minecraftVersion,
            loader
        });
    });
}

function renderAccounts() {
    const activeAccount = getActiveAccount();

    if (refs.accountName) {
        refs.accountName.textContent = activeAccount.name;
    }

    if (refs.accountAvatar) {
        refs.accountAvatar.src = getAccountAvatarUrl(activeAccount.name);
        refs.accountAvatar.alt = `Аватар игрока ${activeAccount.name}`;
    }

    if (!refs.accountList) {
        return;
    }

    if (!state.accounts.length) {
        refs.accountList.innerHTML = `
            <div class="mods-empty-state account-empty-state">
                <div class="mods-empty-title">${escapeHtml(t('account_empty_title'))}</div>
                <div class="mods-empty-copy">${escapeHtml(t('account_empty_copy'))}</div>
            </div>
        `;
        return;
    }

    refs.accountList.innerHTML = state.accounts.map((account) => {
        const isActive = account.id === state.activeAccountId;

        return `
            <article class="account-item ${isActive ? 'is-active' : ''}">
                <div class="account-item-main">
                    <img class="account-item-avatar" src="${escapeHtml(getAccountAvatarUrl(account.name))}" alt="${escapeHtml(account.name)}">
                    <div class="account-item-meta">
                        <div class="account-item-name">${escapeHtml(account.name)}</div>
                        <div class="account-item-badges">
                            <span class="build-pill ${isActive ? 'build-pill--accent' : ''}">${escapeHtml(isActive ? t('account_active') : t('account_label'))}</span>
                        </div>
                    </div>
                </div>
                <div class="account-item-actions">
                    ${!isActive ? `<button class="mods-install-btn" type="button" data-account-select="${escapeHtml(account.id)}">${escapeHtml(t('account_use'))}</button>` : ''}
                    <button class="mods-install-btn" type="button" data-account-edit="${escapeHtml(account.id)}">${escapeHtml(t('account_edit'))}</button>
                    <button class="mods-install-btn is-danger icon-only" type="button" data-account-delete="${escapeHtml(account.id)}" aria-label="${escapeHtml(t('account_delete'))}">
                        <img src="assets/icons/delete_24dp_E3E3E3_FILL1_wght400_GRAD0_opsz24.png" alt="">
                    </button>
                </div>
            </article>
        `;
    }).join('');

    refs.accountList.querySelectorAll('[data-account-select]').forEach((button) => {
        button.addEventListener('click', () => {
            state.activeAccountId = button.getAttribute('data-account-select');
            persistAccountsState();
            renderAccounts();
            updatePlayPanel();
        });
    });

    refs.accountList.querySelectorAll('[data-account-edit]').forEach((button) => {
        button.addEventListener('click', () => {
            const account = state.accounts.find((item) => item.id === button.getAttribute('data-account-edit'));
            if (!account) {
                return;
            }

            state.accountModalMode = 'edit';
            state.editingAccountId = account.id;
            refs.accountNameInput.value = account.name;
            refs.accountModalSave.textContent = t('account_save');
            refs.accountNameInput.focus();
            refs.accountNameInput.select();
        });
    });

    refs.accountList.querySelectorAll('[data-account-delete]').forEach((button) => {
        button.addEventListener('click', () => {
            const accountId = button.getAttribute('data-account-delete');
            const account = state.accounts.find((item) => item.id === accountId);

            if (!account || !window.confirm(t('account_delete_confirm').replace('{name}', account.name))) {
                return;
            }

            state.accounts = state.accounts.filter((item) => item.id !== accountId);
            if (!state.accounts.length) {
                state.accounts = getDefaultAccounts();
            }
            if (!state.accounts.some((item) => item.id === state.activeAccountId)) {
                state.activeAccountId = state.accounts[0].id;
            }
            persistAccountsState();
            renderAccounts();
            updatePlayPanel();
        });
    });
}

function openAccountModal() {
    state.accountModalMode = 'create';
    state.editingAccountId = null;
    refs.accountNameInput.value = '';
    refs.accountModalSave.textContent = t('account_add');
    renderAccounts();
    refs.accountModalOverlay.hidden = false;
    refs.accountNameInput.focus();
}

function closeAccountModal() {
    refs.accountModalOverlay.hidden = true;
    state.accountModalMode = 'create';
    state.editingAccountId = null;
    refs.accountNameInput.value = '';
    refs.accountCard?.focus();
}

async function saveAccountFromModal() {
    const name = refs.accountNameInput.value.trim();
    if (!name) {
        refs.accountNameInput.focus();
        return;
    }

    refs.accountModalSave.disabled = true;

    try {
        if (state.accountModalMode === 'edit' && state.editingAccountId) {
            state.accounts = state.accounts.map((account) => account.id === state.editingAccountId
                ? { ...account, name }
                : account);
        } else {
            const id = `account-${Date.now()}`;
            state.accounts.unshift({ id, name, type: 'regular' });
            state.activeAccountId = id;
        }

        persistAccountsState();
        renderAccounts();
        updatePlayPanel();
        closeAccountModal();
    } finally {
        refs.accountModalSave.disabled = false;
    }
}

function openPlayPicker() {
    renderPlayFilters();
    renderPlayPickerList();
    refs.playPickerOverlay.hidden = false;
    refs.playFilterVersion?.focus();
}

function closePlayPicker() {
    refs.playPickerOverlay.hidden = true;
    refs.playSelectBtn?.focus();
}

function openBuildModal(mode, build = null) {
    state.buildModalMode = mode;
    state.editingBuildId = build?.id || null;

    document.getElementById('build-modal-title').textContent = mode === 'edit' ? t('build_modal_edit_title') : t('build_modal_create_title');
    refs.modalSaveBtn.textContent = mode === 'edit' ? t('build_save') : t('build_create');
    refs.buildNameInput.value = build ? (build.name || build.id) : '';
    refs.buildVersionSelect.value = build?.minecraftVersion || getActiveBuild().minecraftVersion || state.buildOptions.gameVersions[0];
    refs.buildLoaderSelect.value = build?.loader || getActiveBuild().loader || state.buildOptions.loaders[0];

    refs.modalOverlay.hidden = false;
    refs.buildNameInput.focus();
    refs.buildNameInput.select();
}

function closeBuildModal() {
    refs.modalOverlay.hidden = true;
    state.buildModalMode = 'create';
    state.editingBuildId = null;
    refs.buildsCreateBtn?.focus();
}

async function saveBuildFromModal() {
    const payload = {
        name: refs.buildNameInput.value.trim(),
        minecraftVersion: refs.buildVersionSelect.value,
        loader: refs.buildLoaderSelect.value
    };

    if (!payload.name) {
        refs.buildNameInput.focus();
        return;
    }

    refs.modalSaveBtn.disabled = true;

    try {
        if (state.buildModalMode === 'edit' && state.editingBuildId) {
            await window.launcherBuilds.update({
                id: state.editingBuildId,
                ...payload
            });
        } else {
            await window.launcherBuilds.create(payload);
        }

        await refreshBuildsState();
        closeBuildModal();
        
        // Явное обновление заголовка и панели сразу же
        updateToolbarTitle();
        updatePlayPanel();
        updateModsStatus(t('build_saved'));
    } catch (error) {
        updateModsStatus(`${t('error_prefix')}: ${error.message}`);
    } finally {
        refs.modalSaveBtn.disabled = false;
    }
}

async function refreshBuildsState() {
    const buildsState = await window.launcherBuilds.list();
    state.builds = Array.isArray(buildsState?.builds) ? buildsState.builds : [];
    state.activeBuildId = buildsState?.activeBuildId || state.activeBuildId;
    state.settings.activeBuildId = state.activeBuildId;
    await refreshInstalledMods();
    renderPlayFilters();
    renderBuilds();
    renderPlayPickerList();
    renderLoaderShowcase();
    updateToolbarTitle();
    updatePlayPanel();
    updateLaunchUi();

    if (state.activeView === 'mods') {
        const activeBuild = getActiveBuild();
        const cached = activeBuild ? getCachedModsForBuild(activeBuild.id) : null;

        if (cached && cached.query === state.modsQuery && cached.page === state.modsCurrentPage && Array.isArray(cached.results) && cached.results.length) {
            state.modsResults = cached.results;
            state.modsTotalCount = Number(cached.total || 0);
            renderModsResults();
            updateModsStatus(state.modsTotalCount
                ? `${state.modsTotalCount} • ${formatLoader(activeBuild.loader)} ${activeBuild.minecraftVersion}`
                : t('mods_search_empty'));
        }

        await performModsSearch();
    }
}

async function setActiveBuild(buildId) {
    try {
        await window.launcherBuilds.setActive(buildId);
        await refreshBuildsState();
        await persistSettings({ activeBuildId: buildId }, false);
        updateModsStatus(t('build_selected'));
    } catch (error) {
        updateModsStatus(`${t('error_prefix')}: ${error.message}`);
    }
}

async function deleteBuild(buildId) {
    const build = state.builds.find((item) => item.id === buildId);
    if (!build) {
        return;
    }

    if (build.isDefault) {
        updateModsStatus(t('build_delete_default_error'));
        return;
    }

    const confirmed = window.confirm(t('build_delete_confirm').replace('{name}', getBuildDisplayName(build)));
    if (!confirmed) {
        return;
    }

    try {
        await window.launcherBuilds.delete(buildId);
        await refreshBuildsState();
        updateModsStatus(t('build_deleted'));
    } catch (error) {
        updateModsStatus(`${t('error_prefix')}: ${error.message}`);
    }
}

async function persistSettings(patch = {}, updateStatus = true) {
    state.settings = { ...state.settings, ...patch };

    if (updateStatus) {
        setSaveState('saving');
    }

    const saved = await window.launcherSettings.save(state.settings);
    state.settings = { ...state.settings, ...saved };

    if (updateStatus) {
        setSaveState('saved');
    }
}

function setSaveState(mode) {
    refs.saveState.dataset.state = mode;
    updateSaveStateLabel();
}

function updateSaveStateLabel() {
    const mode = refs.saveState.dataset.state || 'idle';
    refs.saveState.textContent = mode === 'saving'
        ? t('save_saving')
        : mode === 'saved'
            ? t('save_saved')
            : t('save_unsaved');
}