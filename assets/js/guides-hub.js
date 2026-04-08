(function () {
  const searchInput = document.querySelector("[data-guide-search-input]");
  const cards = Array.from(document.querySelectorAll("[data-guide-card]"));
  const chips = Array.from(document.querySelectorAll("[data-guide-category-chip]"));
  const typeChips = Array.from(document.querySelectorAll("[data-guide-type-chip]"));
  const results = document.querySelector("[data-guide-results-count]");
  const emptyState = document.querySelector("[data-guide-empty]");
  const resetButton = document.querySelector("[data-guide-reset]");

  if (!searchInput || cards.length === 0) return;

  const params = new URLSearchParams(window.location.search);
  let activeCategory = (params.get("category") || "all").trim();
  let activeType = (params.get("type") || "all").trim();
  let query = (params.get("q") || "").trim();

  const normalize = (value) => value.toLowerCase().trim();

  function cardText(card) {
    return normalize([
      card.dataset.guideTitle || "",
      card.dataset.guideCategories || "",
      card.dataset.guideKeywords || "",
      card.textContent || ""
    ].join(" "));
  }

  function cardCategories(card) {
    return (card.dataset.guideCategories || "")
      .split(",")
      .map((value) => normalize(value))
      .filter(Boolean);
  }

  function syncChips() {
    chips.forEach((chip) => {
      const isActive = normalize(chip.dataset.guideCategory || "all") === normalize(activeCategory);
      chip.setAttribute("aria-pressed", isActive ? "true" : "false");
      chip.classList.toggle("is-active", isActive);
    });

    typeChips.forEach((chip) => {
      const isActive = normalize(chip.dataset.guideType || "all") === normalize(activeType);
      chip.setAttribute("aria-pressed", isActive ? "true" : "false");
      chip.classList.toggle("is-active", isActive);
    });
  }

  function syncUrl() {
    const nextParams = new URLSearchParams(window.location.search);

    if (query) {
      nextParams.set("q", query);
    } else {
      nextParams.delete("q");
    }

    if (activeCategory && normalize(activeCategory) !== "all") {
      nextParams.set("category", activeCategory);
    } else {
      nextParams.delete("category");
    }

    if (activeType && normalize(activeType) !== "all") {
      nextParams.set("type", activeType);
    } else {
      nextParams.delete("type");
    }

    const nextSearch = nextParams.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }

  function applyFilters() {
    const normalizedQuery = normalize(query);
    const normalizedCategory = normalize(activeCategory || "all");
    const normalizedType = normalize(activeType || "all");
    let visibleCount = 0;

    cards.forEach((card) => {
      const categoryMatch = normalizedCategory === "all" || cardCategories(card).includes(normalizedCategory);
      const typeMatch = normalizedType === "all" || normalize(card.dataset.guideType || "") === normalizedType;
      const queryMatch = !normalizedQuery || cardText(card).includes(normalizedQuery);
      const visible = categoryMatch && typeMatch && queryMatch;

      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (results) {
      results.innerHTML = visibleCount === 1 ? "<strong>1</strong> article" : `<strong>${visibleCount}</strong> articles`;
    }

    if (emptyState) {
      emptyState.classList.toggle("is-visible", visibleCount === 0);
    }

    syncChips();
    syncUrl();
  }

  searchInput.value = query;

  searchInput.addEventListener("input", (event) => {
    query = event.target.value.trim();
    applyFilters();
  });

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      activeCategory = chip.dataset.guideCategory || "all";
      applyFilters();
    });
  });

  typeChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      activeType = chip.dataset.guideType || "all";
      applyFilters();
    });
  });

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      query = "";
      activeCategory = "all";
      activeType = "all";
      searchInput.value = "";
      applyFilters();
    });
  }

  applyFilters();
})();
