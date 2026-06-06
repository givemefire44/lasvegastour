'use client';

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/lib/image";

export default function LugaresPopularesArg({ destinations = [] }: { destinations?: any[] }) {
  const lugares = destinations.map(item => ({
    nombre: item.nombre,
    img: item.image ? urlFor(item.image).width(400).height(300).format('webp').quality(85).url() : '',
    url: item.url || '#'
  }));

  if (lugares.length === 0) return null;

  return (
    <section className="lugares-populares">
      <div className="lugares-populares-masonry">
        {lugares.map((lugar, i) => (
          <Link
            href={lugar.url}
            key={`${lugar.nombre}-${i}`}
            className={`lugar-card-masonry lugar-card-masonry-${i + 1}`}
            aria-label={`Ver más de ${lugar.nombre}`}
          >
            <div className="lugar-image-container">
              <Image
                src={lugar.img}
                alt={lugar.nombre}
                fill
                style={{ objectFit: 'cover', transition: 'transform 0.3s ease' }}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                loading="lazy"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
              />
            </div>
            <span className="lugar-card-titulo">{lugar.nombre}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}