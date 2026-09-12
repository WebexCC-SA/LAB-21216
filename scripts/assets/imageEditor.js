(() => {
    "use strict";

    const EDITOR_API = "http://127.0.0.1:8765";
    const EDIT_QUERY = "image-edit";
    const state = {
        token: "",
        pages: [],
        initialized: false,
        listSelectionAnchor: null,
        imageOffsetStep: 16,
        maxImageOffset: 512
    };

    function editorUrl(href) {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) {
            return null;
        }
        url.searchParams.set(EDIT_QUERY, "1");
        return url;
    }

    function sourcePageForPath(pathname) {
        const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
        return [...state.pages]
            .sort((first, second) => second.route.length - first.route.length)
            .find((page) => normalizedPath.endsWith(`/${page.route}`)) || null;
    }

    function imageSource(image) {
        const sourceUrl = new URL(image.currentSrc || image.src, window.location.href);
        const marker = "/assets/";
        const markerIndex = sourceUrl.pathname.indexOf(marker);
        if (markerIndex < 0) {
            return null;
        }
        return decodeURIComponent(
            `assets/${sourceUrl.pathname.slice(markerIndex + marker.length)}`
        );
    }

    function addEditorStyles() {
        if (document.querySelector("#lab-image-editor-styles")) {
            return;
        }
        const style = document.createElement("style");
        style.id = "lab-image-editor-styles";
        style.textContent = `
            .lab-image-editor-frame {
                display: inline-block;
                max-width: 100%;
                min-width: 24px;
                min-height: 24px;
                overflow: hidden;
                position: relative;
                resize: both;
                outline: 2px dashed var(--md-accent-fg-color);
                outline-offset: 3px;
                vertical-align: top;
            }
            .lab-image-editor-frame > a,
            .lab-image-editor-frame > img,
            .lab-image-editor-frame > a > img {
                display: block;
                height: 100% !important;
                margin: 0 !important;
                max-height: none !important;
                max-width: none !important;
                width: 100% !important;
            }
            .lab-image-editor-size {
                background: rgba(0, 0, 0, 0.78);
                bottom: 4px;
                color: #fff;
                font: 12px/1.4 monospace;
                padding: 2px 5px;
                pointer-events: none;
                position: absolute;
                right: 4px;
                z-index: 2;
            }
            .lab-image-editor-move {
                display: flex;
                gap: 4px;
                left: 50%;
                position: absolute;
                top: 4px;
                transform: translateX(-50%);
                z-index: 3;
            }
            .lab-image-editor-move button {
                background: rgba(0, 0, 0, 0.78);
                border: 1px solid #fff;
                border-radius: 3px;
                color: #fff;
                cursor: pointer;
                font: bold 16px/1 sans-serif;
                height: 28px;
                padding: 0;
                width: 32px;
            }
            .lab-image-editor-move button:disabled {
                cursor: not-allowed;
                opacity: 0.45;
            }
            .lab-image-editor-status {
                background: var(--md-default-bg-color);
                border: 1px solid var(--md-accent-fg-color);
                border-radius: 4px;
                bottom: 16px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                color: var(--md-default-fg-color);
                font-size: 13px;
                max-width: min(420px, calc(100vw - 32px));
                padding: 8px 12px;
                position: fixed;
                right: 16px;
                z-index: 20;
            }
            .lab-list-editor-item {
                position: relative;
            }
            .lab-list-editor-item-selected {
                outline: 2px solid var(--md-accent-fg-color);
                outline-offset: 3px;
            }
            .lab-list-editor-selector {
                background: var(--md-default-bg-color);
                border: 1px solid var(--md-accent-fg-color);
                border-radius: 3px;
                color: var(--md-accent-fg-color);
                cursor: pointer;
                font-size: 12px;
                height: 22px;
                left: -34px;
                line-height: 18px;
                padding: 0;
                position: absolute;
                top: 1px;
                width: 24px;
            }
            .lab-list-editor-item-selected > .lab-list-editor-selector {
                background: var(--md-accent-fg-color);
                color: var(--md-accent-bg-color);
            }
            .lab-list-editor-toolbar {
                align-items: center;
                background: var(--md-default-bg-color);
                border: 1px solid var(--md-accent-fg-color);
                border-radius: 4px;
                bottom: 16px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                left: 16px;
                max-width: min(620px, calc(100vw - 32px));
                padding: 8px 12px;
                position: fixed;
                z-index: 20;
            }
            .lab-list-editor-toolbar button {
                cursor: pointer;
                font: inherit;
                padding: 4px 8px;
            }
        `;
        document.head.append(style);
    }

    function showStatus(message, isError = false) {
        let status = document.querySelector(".lab-image-editor-status");
        if (!status) {
            status = document.createElement("div");
            status.className = "lab-image-editor-status";
            status.setAttribute("role", "status");
            status.setAttribute("aria-live", "polite");
            document.body.append(status);
        }
        status.textContent = message;
        status.style.borderColor = isError
            ? "var(--md-typeset-del-color)"
            : "var(--md-accent-fg-color)";
    }

    function addEditorTab() {
        const tabList = document.querySelector(".md-tabs__list");
        if (!tabList) {
            return;
        }
        const existingEditor = tabList.querySelector(
            '[data-lab-image-editor-tab="true"]'
        );
        const labLink = [...tabList.querySelectorAll("a.md-tabs__link")]
            .find((link) => link.textContent.trim() === "Lab");
        if (!labLink) {
            return;
        }

        let editorItem = existingEditor;
        if (!editorItem) {
            editorItem = labLink.closest("li").cloneNode(true);
            editorItem.dataset.labImageEditorTab = "true";
            const editorLink = editorItem.querySelector("a.md-tabs__link");
            const target = editorUrl(labLink.href);
            if (!target) {
                return;
            }
            editorLink.href = target.href;
            editorLink.textContent = "Lab (edit)";
            labLink.closest("li").after(editorItem);
        }

        const editing = new URLSearchParams(window.location.search)
            .get(EDIT_QUERY) === "1";
        editorItem.classList.toggle("md-tabs__item--active", editing);
        if (editing) {
            labLink.closest("li").classList.remove("md-tabs__item--active");
        }
    }

    function preserveEditorNavigation() {
        document.querySelectorAll("a[href]").forEach((link) => {
            if (
                link.closest('[data-lab-image-editor-tab="true"]') ||
                (link.closest(".md-tabs") && link.textContent.trim() === "Lab")
            ) {
                return;
            }
            const url = new URL(link.href, window.location.href);
            if (
                url.origin === window.location.origin &&
                sourcePageForPath(url.pathname)
            ) {
                url.searchParams.set(EDIT_QUERY, "1");
                link.href = url.href;
            }
        });
    }

    async function saveDimensions(frame) {
        const width = Math.max(1, Math.round(frame.clientWidth));
        const height = Math.max(1, Math.round(frame.clientHeight));
        if (
            width === Number(frame.dataset.savedWidth) &&
            height === Number(frame.dataset.savedHeight)
        ) {
            return;
        }

        showStatus(`Saving ${width} × ${height}…`);
        try {
            const response = await fetch(`${EDITOR_API}/resize`, {
                method: "POST",
                mode: "cors",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    "X-Image-Editor-Token": state.token
                },
                body: JSON.stringify({
                    page: frame.dataset.page,
                    source: frame.dataset.source,
                    occurrence: Number(frame.dataset.occurrence),
                    width,
                    height
                })
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "The image size could not be saved.");
            }
            frame.dataset.savedWidth = String(width);
            frame.dataset.savedHeight = String(height);
            showStatus(`Saved ${width} × ${height}. The Lab page is updated.`);
        } catch (error) {
            showStatus(error.message, true);
        }
    }

    async function moveImage(frame, direction, leftButton, rightButton) {
        leftButton.disabled = true;
        rightButton.disabled = true;
        showStatus(`Moving image ${direction}…`);
        try {
            const response = await fetch(`${EDITOR_API}/move-image`, {
                method: "POST",
                mode: "cors",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    "X-Image-Editor-Token": state.token
                },
                body: JSON.stringify({
                    page: frame.dataset.page,
                    source: frame.dataset.source,
                    occurrence: Number(frame.dataset.occurrence),
                    direction
                })
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "The image could not be moved.");
            }
            const offset = result.updated.offset;
            frame.dataset.offset = String(offset);
            frame.dataset.maximumOffset = String(
                result.updated.maximum_offset
            );
            frame.style.marginLeft = `${offset}px`;
            showStatus(
                `Moved image ${direction} to ${offset}px. The Lab page is updated.`
            );
        } catch (error) {
            showStatus(error.message, true);
        } finally {
            const offset = Number(frame.dataset.offset);
            const maximumOffset = Number(frame.dataset.maximumOffset);
            leftButton.disabled = offset <= 0;
            rightButton.disabled = offset >= maximumOffset;
        }
    }

    function enableImageResizing(page) {
        addEditorStyles();
        showStatus("Drag an image from its lower-right corner to resize it.");
        const occurrences = new Map();

        document.querySelectorAll("article.md-content__inner img").forEach((image) => {
            if (image.closest(".lab-image-editor-frame")) {
                return;
            }
            const source = imageSource(image);
            if (!source) {
                return;
            }
            const occurrence = occurrences.get(source) || 0;
            occurrences.set(source, occurrence + 1);

            const imageRect = image.getBoundingClientRect();
            const target = image.closest("a.glightbox") || image;
            const frame = document.createElement("span");
            frame.className = "lab-image-editor-frame";
            frame.style.width = `${Math.max(24, Math.round(imageRect.width))}px`;
            frame.style.height = `${Math.max(24, Math.round(imageRect.height))}px`;
            frame.dataset.page = page.source;
            frame.dataset.source = source;
            frame.dataset.occurrence = String(occurrence);
            frame.dataset.savedWidth = String(Math.round(imageRect.width));
            frame.dataset.savedHeight = String(Math.round(imageRect.height));
            frame.dataset.offset = String(
                Math.max(0, parseInt(image.style.marginLeft, 10) || 0)
            );
            frame.dataset.maximumOffset = String(state.maxImageOffset);
            frame.style.marginLeft = `${frame.dataset.offset}px`;

            const badge = document.createElement("span");
            badge.className = "lab-image-editor-size";
            badge.textContent = `${Math.round(imageRect.width)} × ${Math.round(imageRect.height)}`;
            const moveControls = document.createElement("span");
            moveControls.className = "lab-image-editor-move";
            const leftButton = document.createElement("button");
            leftButton.type = "button";
            leftButton.textContent = "←";
            leftButton.title = (
                `Move image left ${state.imageOffsetStep} pixels`
            );
            leftButton.setAttribute("aria-label", leftButton.title);
            leftButton.disabled = Number(frame.dataset.offset) <= 0;
            const rightButton = document.createElement("button");
            rightButton.type = "button";
            rightButton.textContent = "→";
            rightButton.title = (
                `Move image right ${state.imageOffsetStep} pixels`
            );
            rightButton.setAttribute("aria-label", rightButton.title);
            moveControls.append(leftButton, rightButton);

            target.before(frame);
            frame.append(target, badge, moveControls);
            image.draggable = false;
            target.addEventListener("click", (event) => event.preventDefault());
            moveControls.addEventListener(
                "pointerdown",
                (event) => event.stopPropagation()
            );
            leftButton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                moveImage(frame, "left", leftButton, rightButton);
            });
            rightButton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                moveImage(frame, "right", leftButton, rightButton);
            });

            const observer = new ResizeObserver(() => {
                badge.textContent = `${Math.round(frame.clientWidth)} × ${Math.round(frame.clientHeight)}`;
            });
            observer.observe(frame);
            frame.addEventListener("pointerdown", () => {
                document.addEventListener(
                    "pointerup",
                    () => saveDimensions(frame),
                    { once: true }
                );
            });
        });
    }

    function orderedListDepth(item) {
        let depth = 0;
        let parentItem = item.parentElement.closest("li");
        while (parentItem) {
            depth += 1;
            parentItem = parentItem.parentElement.closest("li");
        }
        return depth;
    }

    function updateListSelection(entries, selectedIndices) {
        entries.forEach((entry) => {
            const selected = selectedIndices.has(entry.index);
            entry.item.classList.toggle(
                "lab-list-editor-item-selected",
                selected
            );
            entry.selector.textContent = selected ? "✓" : "□";
            entry.selector.setAttribute("aria-pressed", String(selected));
        });
    }

    function clearListSelection(entries, selectedIndices) {
        selectedIndices.clear();
        state.listSelectionAnchor = null;
        updateListSelection(entries, selectedIndices);
    }

    function selectListRange(
        entries, selectedIndices, targetEntry, useRange
    ) {
        if (
            useRange &&
            state.listSelectionAnchor &&
            state.listSelectionAnchor.depth === targetEntry.depth
        ) {
            const peers = entries.filter(
                (entry) => entry.depth === targetEntry.depth
            );
            const firstPosition = peers.indexOf(state.listSelectionAnchor);
            const lastPosition = peers.indexOf(targetEntry);
            if (firstPosition >= 0 && lastPosition >= 0) {
                const start = Math.min(firstPosition, lastPosition);
                const end = Math.max(firstPosition, lastPosition);
                for (let position = start; position <= end; position += 1) {
                    selectedIndices.add(peers[position].index);
                }
            }
        } else if (selectedIndices.has(targetEntry.index)) {
            selectedIndices.delete(targetEntry.index);
            state.listSelectionAnchor = null;
        } else {
            selectedIndices.add(targetEntry.index);
            state.listSelectionAnchor = targetEntry;
        }
        updateListSelection(entries, selectedIndices);
    }

    function validateListSelection(entries, selectedIndices, direction) {
        const selected = entries
            .filter((entry) => selectedIndices.has(entry.index))
            .sort((first, second) => first.index - second.index);
        if (!selected.length) {
            throw new Error("Select at least one numbered list item.");
        }
        const depths = new Set(selected.map((entry) => entry.depth));
        if (depths.size !== 1) {
            throw new Error("Selected items must be at the same list level.");
        }

        const depth = selected[0].depth;
        if (direction === "right" && depth !== 0) {
            throw new Error("Only first-level items can be indented right.");
        }
        if (direction === "left" && depth !== 1) {
            throw new Error("Only second-level items can be indented left.");
        }
        const peers = entries.filter((entry) => entry.depth === depth);
        const positions = selected.map((entry) => peers.indexOf(entry));
        const firstPosition = Math.min(...positions);
        const lastPosition = Math.max(...positions);
        if (lastPosition - firstPosition + 1 !== selected.length) {
            throw new Error("Select a consecutive set of sibling list items.");
        }
        return selected.map((entry) => entry.index);
    }

    async function moveSelectedItems(
        page, entries, selectedIndices, moveButton, direction
    ) {
        let indices;
        try {
            indices = validateListSelection(
                entries, selectedIndices, direction
            );
        } catch (error) {
            showStatus(error.message, true);
            return;
        }

        moveButton.disabled = true;
        showStatus(
            `Indenting ${indices.length} list item(s) ${direction}…`
        );
        try {
            const response = await fetch(`${EDITOR_API}/move-list`, {
                method: "POST",
                mode: "cors",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    "X-Image-Editor-Token": state.token
                },
                body: JSON.stringify({
                    page: page.source,
                    selected_indices: indices,
                    direction
                })
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "The list could not be indented.");
            }
            clearListSelection(entries, selectedIndices);
            showStatus(
                `Indented ${result.updated.moved_items} item(s) ${direction}. The Lab page is updating.`
            );
        } catch (error) {
            showStatus(error.message, true);
        } finally {
            moveButton.disabled = false;
        }
    }

    async function undoLastEdit(undoButton) {
        undoButton.disabled = true;
        showStatus("Undoing the last editor change…");
        try {
            const response = await fetch(`${EDITOR_API}/undo`, {
                method: "POST",
                mode: "cors",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    "X-Image-Editor-Token": state.token
                },
                body: "{}"
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || "The last edit could not be undone.");
            }
            showStatus(
                `Undid the last edit in ${result.updated.page}. The Lab page is updating.`
            );
        } catch (error) {
            showStatus(error.message, true);
        } finally {
            undoButton.disabled = false;
        }
    }

    function removeListEditorUi() {
        document.querySelector(".lab-list-editor-toolbar")?.remove();
        document.querySelectorAll(".lab-list-editor-selector").forEach(
            (selector) => selector.remove()
        );
        document.querySelectorAll(".lab-list-editor-item").forEach((item) => {
            item.classList.remove(
                "lab-list-editor-item",
                "lab-list-editor-item-selected"
            );
        });
        state.listSelectionAnchor = null;
    }

    function enableListEditing(page) {
        const items = [
            ...document.querySelectorAll("article.md-content__inner ol > li")
        ];
        const selectedIndices = new Set();
        let entries = [];
        let indentModeActive = false;
        const toolbar = document.createElement("div");
        toolbar.className = "lab-list-editor-toolbar";
        const instructions = document.createElement("span");
        instructions.textContent = "List indentation editing is off.";
        const modeButton = document.createElement("button");
        modeButton.type = "button";
        modeButton.textContent = "Start indent edit mode";
        const rightButton = document.createElement("button");
        rightButton.type = "button";
        rightButton.textContent = "Indent right";
        rightButton.hidden = true;
        rightButton.disabled = true;
        rightButton.addEventListener("click", () => {
            moveSelectedItems(
                page, entries, selectedIndices, rightButton, "right"
            ).then(updateDirectionButtons);
        });
        const leftButton = document.createElement("button");
        leftButton.type = "button";
        leftButton.textContent = "Indent left";
        leftButton.hidden = true;
        leftButton.disabled = true;
        leftButton.addEventListener("click", () => {
            moveSelectedItems(
                page, entries, selectedIndices, leftButton, "left"
            ).then(updateDirectionButtons);
        });
        const clearButton = document.createElement("button");
        clearButton.type = "button";
        clearButton.textContent = "Clear selection";
        clearButton.hidden = true;
        clearButton.addEventListener("click", () => {
            clearListSelection(entries, selectedIndices);
            updateDirectionButtons();
        });
        const undoButton = document.createElement("button");
        undoButton.type = "button";
        undoButton.textContent = "Undo last edit";
        undoButton.addEventListener("click", () => {
            undoLastEdit(undoButton);
        });

        function updateDirectionButtons() {
            const selected = entries.filter(
                (entry) => selectedIndices.has(entry.index)
            );
            rightButton.disabled = (
                !selected.length ||
                selected.some((entry) => entry.depth !== 0)
            );
            leftButton.disabled = (
                !selected.length ||
                selected.some((entry) => entry.depth !== 1)
            );
        }

        function stopIndentMode() {
            clearListSelection(entries, selectedIndices);
            entries.forEach((entry) => {
                entry.selector.remove();
                entry.item.classList.remove("lab-list-editor-item");
            });
            entries = [];
            indentModeActive = false;
            instructions.textContent = "List indentation editing is off.";
            modeButton.textContent = "Start indent edit mode";
            rightButton.hidden = true;
            leftButton.hidden = true;
            clearButton.hidden = true;
        }

        function startIndentMode() {
            if (!items.length) {
                showStatus("This page has no numbered list items.", true);
                return;
            }
            entries = items.map((item, index) => {
                const selector = document.createElement("button");
                selector.type = "button";
                selector.className = "lab-list-editor-selector";
                selector.textContent = "□";
                selector.setAttribute(
                    "aria-label",
                    `Select numbered list item ${index + 1}`
                );
                selector.setAttribute("aria-pressed", "false");
                item.classList.add("lab-list-editor-item");
                item.prepend(selector);
                return {
                    item,
                    selector,
                    index,
                    depth: orderedListDepth(item)
                };
            });
            entries.forEach((entry) => {
                entry.selector.addEventListener("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    selectListRange(
                        entries,
                        selectedIndices,
                        entry,
                        event.shiftKey
                    );
                    updateDirectionButtons();
                });
            });
            indentModeActive = true;
            instructions.textContent = (
                "Select consecutive items (Shift-click selects a range)."
            );
            modeButton.textContent = "Stop indent edit mode";
            rightButton.hidden = false;
            leftButton.hidden = false;
            clearButton.hidden = false;
            updateDirectionButtons();
        }

        modeButton.addEventListener("click", () => {
            if (indentModeActive) {
                stopIndentMode();
            } else {
                startIndentMode();
            }
        });
        toolbar.append(
            instructions,
            modeButton,
            rightButton,
            leftButton,
            clearButton,
            undoButton
        );
        document.body.append(toolbar);
    }

    function setupCurrentPage() {
        addEditorTab();
        removeListEditorUi();
        const editing = new URLSearchParams(window.location.search)
            .get(EDIT_QUERY) === "1";
        if (!editing) {
            return;
        }
        const page = sourcePageForPath(window.location.pathname);
        if (!page) {
            return;
        }
        preserveEditorNavigation();
        enableImageResizing(page);
        enableListEditing(page);
    }

    async function initialize() {
        if (!state.initialized) {
            try {
                const response = await fetch(`${EDITOR_API}/config`, {
                    mode: "cors",
                    cache: "no-store"
                });
                if (!response.ok) {
                    return;
                }
                const config = await response.json();
                state.token = config.token;
                state.pages = config.pages;
                state.imageOffsetStep = config.image_offset_step;
                state.maxImageOffset = config.max_image_offset;
                state.initialized = true;
            } catch {
                return;
            }
        }
        setupCurrentPage();
    }

    initialize();
    if (typeof document$ !== "undefined") {
        document$.subscribe(initialize);
    }
})();
