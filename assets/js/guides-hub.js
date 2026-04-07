(function () {
  const searchInput = document.querySelector("[data-guide-search-input]");
  const cards = Array.from(document.querySelectorAll("[data-guide-card]"));
  const chips = Array.from(document.querySelectorAll("[data-guide-category-chip]"));
  const results = document.querySelector("[data-guide-results-count]");
  const emptyState = document.querySelector("[data-guide-empty]");

  if (!searchInput || cards.length === 0) return;

  const params = new URLSearchParams(window.location.search);
  let activeCategory = (params.get("category") || "all").trim();
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

    const nextSearch = nextParams.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }

  function applyFilters() {
    const normalizedQuery = normalize(query);
    const normalizedCategory = normalize(activeCategory || "all");
    let visibleCount = 0;

    cards.forEach((card) => {
      const categoryMatch = normalizedCategory === "all" || cardCategories(card).includes(normalizedCategory);
      const queryMatch = !normalizedQuery || cardText(card).includes(normalizedQuery);
      const visible = categoryMatch && queryMatch;

      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (results) {
      results.textContent = visibleCount === 1 ? "1 guide" : `${visibleCount} guides`;
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

  applyFilters();
})();
