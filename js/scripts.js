"use strict";

/*
    Shared navigation script.

    Each navigation link opens a separate HTML page.
    This script marks the current page in the navigation.

    Real data, charts and filter logic will be added later.
*/

document.addEventListener("DOMContentLoaded", () => {
    const currentPage =
        window.location.pathname.split("/").pop() || "index.html";

    const navigationLinks =
        document.querySelectorAll(".site-nav a");

    navigationLinks.forEach((link) => {
        const linkedPage = link.getAttribute("href");

        if (linkedPage === currentPage) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });
});