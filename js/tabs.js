// Navigation par onglets (souris et clavier : flèches gauche / droite, Début, Fin)

function switchToTab(tabName, { focus = false } = {}) {
    tabBtns.forEach(b => {
        const selected = b.getAttribute('data-tab') === tabName;
        b.classList.toggle('active', selected);
        b.setAttribute('aria-selected', String(selected));
        b.tabIndex = selected ? 0 : -1;
        if (selected && focus) b.focus();
    });
    tabContents.forEach(tc => tc.classList.toggle('active', tc.id === tabName));
    if (tabName === 'specificities') loadSpecificities();
}

tabBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => switchToTab(btn.getAttribute('data-tab')));

    btn.addEventListener('keydown', (e) => {
        const last = tabBtns.length - 1;
        let target = null;
        if (e.key === 'ArrowRight') target = index === last ? 0 : index + 1;
        else if (e.key === 'ArrowLeft') target = index === 0 ? last : index - 1;
        else if (e.key === 'Home') target = 0;
        else if (e.key === 'End') target = last;
        if (target === null) return;
        e.preventDefault();
        switchToTab(tabBtns[target].getAttribute('data-tab'), { focus: true });
    });
});
