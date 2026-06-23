"use client";
import React from "react";
import Link from "next/link";

type Bubble = { text: string; image?: string; href?: string };

export default function BubbleComments({ comments }: { comments: Bubble[] }) {
  return (
    <div className="hero-bubbles">
      {comments.map((c, idx) => {
        const inner = (
          <>
            {c.image && (
              <img src={c.image} alt={c.text} className="hero-bubble-img" loading="lazy" />
            )}
            <span className="hero-bubble-text">{c.text}</span>
          </>
        );
        return c.href ? (
          <Link key={idx} href={c.href} className="hero-bubble" aria-label={c.text}>
            {inner}
          </Link>
        ) : (
          <div key={idx} className="hero-bubble">
            {inner}
          </div>
        );
      })}

      <style jsx>{`
        .hero-bubbles {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: flex-start;
          gap: clamp(16px, 4vw, 40px);
          margin: 8px auto 24px;
          max-width: 720px;
        }
        .hero-bubble {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          cursor: pointer;
          transition: transform 0.25s ease;
        }
        .hero-bubble:hover {
          transform: translateY(-4px) scale(1.04);
        }
        .hero-bubble-img {
          width: clamp(96px, 19vw, 142px);
          height: clamp(96px, 19vw, 142px);
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
          display: block;
        }
        .hero-bubble:hover .hero-bubble-img {
          border-color: #ffffff;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
        }
        .hero-bubble-text {
          background: rgba(255, 255, 255, 0.95);
          color: #7c3aed;
          font-weight: 700;
          font-size: clamp(0.8rem, 2.2vw, 0.95rem);
          line-height: 1;
          padding: 6px 14px;
          border-radius: 999px;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .hero-bubble:hover .hero-bubble-text {
          color: #6d28d9;
        }
        @media (max-width: 480px) {
          .hero-bubbles {
            gap: 14px;
          }
          .hero-bubble-text {
            font-size: 0.72rem;
            padding: 4px 10px;
          }
        }
      `}</style>
    </div>
  );
}
