import React from "react";

export default function ImpactBanner() {
  return (
    <section className="impact-banner">
      <div className="impact-banner-content">
        <h2>
          Find <span>Tours</span> in the Most Popular Places.
        </h2>
        <div className="impact-banner-arrow" aria-label="Desliza para ver más">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <path d="M10 16l10 10 10-10" stroke="#FFD600" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </section>
  );
}
