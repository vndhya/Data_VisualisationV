"use strict";

/*
    Initial prototype interactions.

    Currently:
    - Navigation switches between the three sections.
    - The hero button opens the dashboard section.

    Data loading, D3 charts and filter logic will be added later.
*/

document.addEventListener("DOMContentLoaded", () => {
    const navigationButtons = document.querySelectorAll(".nav-button");
    const pageSections = document.querySelectorAll(".page-section");

    const exploreButton = document.querySelector(".primary-button");

    function showSection(sectionId) {
        const targetSection = document.getElementById(sectionId);

        if (!targetSection) {
            return;
        }

        // Display the selected section.
        pageSections.forEach((section) => {
            section.hidden = section.id !== sectionId;
        });

        // Update the navigation appearance and accessible state.
        navigationButtons.forEach((button) => {
            const isActive = button.dataset.section === sectionId;

            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
    }

    navigationButtons.forEach((button) => {
        button.addEventListener("click", () => {
            showSection(button.dataset.section);
        });
    });

    exploreButton.addEventListener("click", () => {
        showSection("dashboard-section");
    });

    // Default view when the website first opens.
    showSection("dashboard-section");
});