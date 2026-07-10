function ringColor(count, limit) {
    const pct = limit > 0 ? count / limit : 0;
    if (pct >= 1) return "var(--uhl-danger)";
    if (pct >= 0.8) return "var(--uhl-warn)";
    return "var(--uhl-ok)";
}

function buildRingSVG(count, limit, size = 40) {
    const stroke = Math.max(3, Math.round(size * 0.11));
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.min(1, limit > 0 ? count / limit : 0);
    const dash = circumference * pct;
    const color = ringColor(count, limit);
    const center = size / 2;

    return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${count} of ${limit} visits used">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="var(--uhl-line)" stroke-width="${stroke}" />
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="${dash} ${circumference}" stroke-linecap="round"
        transform="rotate(-90 ${center} ${center})" />
    </svg>
  `;
}

export { buildRingSVG, ringColor };
