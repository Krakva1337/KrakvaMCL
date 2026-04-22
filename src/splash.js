// Настройки анимации
const animationConfig = {
    duration: 3000, // Длительность в миллисекундах (3 секунды)
    steps: 100,     // Количество шагов анимации
    startDelay: 100 // Задержка перед началом (мс)
};

// Элементы
const progressBar = document.querySelector('.loader-progress');
const statusText = document.querySelector('.loader-status');
const splashCard = document.querySelector('.splash');
const splashClose = document.querySelector('.splash-close');

// Статусы загрузки
const loadingStatuses = [
    'Инициализация',
    'Загрузка библиотек',
    'Настройка',
    'Оптимизация',
    'Почти готово',
    'Завершение'
];

const loadingStatusesEn = [
    'Starting',
    'Loading Libs',
    'Setting Up',
    'Optimizing',
    'Almost There',
    'Finishing Up'
];


let startTime = null;
let animationFrame = null;
let statusChangeTimer = null;

function easeInOutCubic(value) {
    if (value < 0.5) {
        return 4 * value * value * value;
    }

    return 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function getAnimatedProgress(linearProgress) {
    const normalized = linearProgress / 100;
    const eased = easeInOutCubic(normalized);
    const pulse = Math.sin(normalized * Math.PI * 4) * 1.4;
    return Math.min(Math.max(eased * 100 + pulse, 0), 100);
}

// Функция обновления статуса
function updateStatus(progress) {
    let nextStatus = loadingStatuses[5];

    if (progress < 20) {
        nextStatus = loadingStatuses[0];
    } else if (progress < 40) {
        nextStatus = loadingStatuses[1];
    } else if (progress < 60) {
        nextStatus = loadingStatuses[2];
    } else if (progress < 80) {
        nextStatus = loadingStatuses[3];
    } else if (progress < 95) {
        nextStatus = loadingStatuses[4];
    }

    if (statusText.textContent !== nextStatus) {
        statusText.classList.remove('is-changing');
        void statusText.offsetWidth;
        statusText.classList.add('is-changing');
        statusText.textContent = nextStatus;
        window.clearTimeout(statusChangeTimer);
        statusChangeTimer = window.setTimeout(() => {
            statusText.classList.remove('is-changing');
        }, 220);
    }
}

// Основная функция анимации
function animateLoader(timestamp) {
    if (!startTime) {
        startTime = timestamp;
    }
    
    const elapsed = timestamp - startTime;
    const linearProgress = Math.min((elapsed / animationConfig.duration) * 100, 100);
    const progress = linearProgress >= 100 ? 100 : getAnimatedProgress(linearProgress);
    
    // Плавное обновление ширины
    progressBar.style.width = progress + '%';
    
    // Обновляем статус
    updateStatus(progress);
    
    // Продолжаем анимацию
    if (progress < 100) {
        animationFrame = requestAnimationFrame(animateLoader);
    } else {
        // Анимация завершена
        finishLoading();
    }
}

// Функция завершения загрузки
function finishLoading() {
    statusText.textContent = 'Готово!';
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

// Функция сброса и перезапуска анимации
function resetAndRestart() {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }
    
    startTime = null;
    progressBar.style.width = '0%';
    statusText.textContent = 'Загрузка...';
    statusText.style.color = 'rgba(255, 255, 255, 0.7)';
    
    setTimeout(() => {
        animationFrame = requestAnimationFrame(animateLoader);
    }, animationConfig.startDelay);
}

// Запуск анимации
setTimeout(() => {
    animationFrame = requestAnimationFrame(animateLoader);
}, animationConfig.startDelay);

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

// Опционально: кнопка для перезапуска (можно удалить)
// Добавьте эту кнопку в HTML если нужно
/*
<button onclick="resetAndRestart()" style="position: fixed; bottom: 20px; left: 20px; z-index: 1000;">Перезапустить</button>
*/

// Обработка ошибок (если что-то пошло не так)
window.addEventListener('error', function(e) {
    statusText.textContent = 'Ошибка загрузки';
    statusText.style.color = 'rgba(255, 100, 100, 0.9)';
    if (splashCard) {
        splashCard.classList.remove('is-ready');
        splashCard.classList.add('has-error');
    }
    console.error('Ошибка:', e);
});

// Экспортируем функцию для внешнего использования (опционально)
window.loaderControl = {
    reset: resetAndRestart,
    setDuration: function(newDuration) {
        animationConfig.duration = newDuration;
        resetAndRestart();
    },
    getProgress: function() {
        return parseFloat(progressBar.style.width) || 0;
    }
};
