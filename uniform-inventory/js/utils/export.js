(function() {
  function normalizePageName(pageName) {
    if (!pageName) {
      return 'export';
    }
    return String(pageName)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '');
  }

  window.getCsvFilename = function getCsvFilename(pageName, date = new Date()) {
    const normalizedName = normalizePageName(pageName);
    const isoDate = date.toISOString().split('T')[0];
    return `${normalizedName}_${isoDate}.csv`;
  };
})();
