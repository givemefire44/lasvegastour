'use client';

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/lib/image";

function getCardClass(i: number) {
  let classes = "hostel-mosaic-card";
  if (i % 3 === 0) classes += " mt-24";
  if (i % 3 === 2) classes += " mb-24";
  if (i % 2 === 0) classes += " rotate-neg";
  else classes += " rotate-pos";
  return classes;
}

function getCardStyle(i: number) {
  return {
    transform: i % 2 === 0 ? "rotate(-8deg)" : "rotate(8deg)"
  };
}

export default function HostelMosaic({ mosaicData = [] }: { mosaicData?: any[] }) {
  const hostels = mosaicData.map(item => ({
    name: item.name,
    location: item.location || '',
    img: item.image ? urlFor(item.image).width(400).height(300).format('webp').quality(85).url() : '',
    url: item.url || '#'
  }));

  if (hostels.length === 0) return null;

  return (
    <div className="hostel-mosaic-section">
      <div className="hostel-mosaic-container">
        <div className="hostel-mosaic-info">
          <h2>
            <span className="highlight">Find the Best Tours & Experiences in Las Vegas.</span>
          </h2>
          <div className="hostel-mosaic-info-description">
          We research, compare and curate Las Vegas tours, shows and day trips so you can book with confidence.
          </div>
        </div>
        <div className="hostel-mosaic-list">
          {hostels.slice(0, 9).map((h, i) => (
            <Link 
              href={h.url} 
              key={`${h.name}-${i}`}
              className={getCardClass(i)}
              style={getCardStyle(i)}
            >
              <div className="hostel-image-container">
                <Image
                  src={h.img}
                  alt={h.name}
                  fill
                  style={{ objectFit: 'cover', transition: 'transform 0.3s ease' }}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                  loading="lazy"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                />
              </div>
              <div className="hostel-mosaic-card-content">
                <div className="hostel-mosaic-card-title">{h.name}</div>
                <div className="hostel-mosaic-card-location">{h.location}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}