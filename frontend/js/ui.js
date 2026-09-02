export function initCustomSelect(containerId, labelId, optionsId, onSelectCallback) {
    const label = document.getElementById(labelId);
    const options = document.getElementById(optionsId);

    label.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllSelect(options);
        options.classList.toggle('select-hide');
        label.classList.toggle('select-arrow-active');
    });

    Array.from(options.children).forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            label.innerText = option.innerText;
            options.classList.add('select-hide');
            label.classList.remove('select-arrow-active');

            Array.from(options.children).forEach(el => el.classList.remove('same-as-selected'));
            option.classList.add('same-as-selected');

            onSelectCallback(option.getAttribute('data-value'));
        });
    });
}

export function closeAllSelect(except) {
    document.querySelectorAll('.select-items').forEach(el => {
        if (el !== except) el.classList.add('select-hide');
    });
    document.querySelectorAll('.select-selected').forEach(el => {
        if (el.nextElementSibling !== except) el.classList.remove('select-arrow-active');
    });
}

export function setupUIHelpers(loadingEl) {
    document.addEventListener('click', () => closeAllSelect(null));
    return {
        showLoading: () => { if (loadingEl) loadingEl.style.display = 'flex'; },
        hideLoading: () => { if (loadingEl) loadingEl.style.display = 'none'; }
    };
}