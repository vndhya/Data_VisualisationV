"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const tabList = document.querySelector(".about-tabs");

    const tabs = [
        ...tabList.querySelectorAll('[role="tab"]')
    ];

    const panels = [
        ...document.querySelectorAll(
            '.about-panel[role="tabpanel"]'
        )
    ];

    function activateTab(selectedTab, moveFocus = false) {
        tabs.forEach(tab => {
            const selected = tab === selectedTab;

            tab.setAttribute(
                "aria-selected",
                String(selected)
            );

            tab.tabIndex = selected ? 0 : -1;
        });

        const selectedPanel =
            selectedTab.getAttribute("aria-controls");

        panels.forEach(panel => {
            panel.hidden = panel.id !== selectedPanel;
        });

        if (moveFocus) {
            selectedTab.focus();
        }
    }

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            activateTab(tab);
        });

        tab.addEventListener("keydown", event => {
            const currentIndex = tabs.indexOf(tab);
            let nextIndex;

            switch (event.key) {
                case "ArrowRight":
                    nextIndex = (currentIndex + 1) % tabs.length;
                    break;

                case "ArrowLeft":
                    nextIndex =
                        (currentIndex - 1 + tabs.length) %
                        tabs.length;
                    break;

                case "Home":
                    nextIndex = 0;
                    break;

                case "End":
                    nextIndex = tabs.length - 1;
                    break;

                default:
                    return;
            }

            event.preventDefault();
            activateTab(tabs[nextIndex], true);
        });
    });
});