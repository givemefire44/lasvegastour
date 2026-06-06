"use client";
import React, { useState, useEffect } from "react";

const testimonials = [
  {
    quote: "Amazing experience! The guide was just simply very good. A mix of good information, little stories and light humour.",
    author: "Mary, London",
  },
  {
    quote: "Skip the line access saved us 2 hours of waiting in the heat. The small group size meant we could actually hear and ask questions.",
    author: "Anna K., Berlin",
  },
  {
    quote: "Our guide Marco made history come alive. The underground tunnels were eerie and fascinating. Worth every euro.",
    author: "James T., London",
  },
  {
    quote: "Booked last minute after reading this site. Best decision of our Rome trip. The arena floor access was incredible.",
    author: "Michael R., Sydney",
  },
  {
    quote: "Traveled with my elderly mother who uses a wheelchair. The private tour accommodated us perfectly. So grateful.",
    author: "Elena P., Toronto",
  },
  {
    quote: "Third time visiting Rome, first time doing the underground tour. Can't believe what I was missing all these years!",
    author: "Roberto L., Madrid",
  },
  {
    quote: "The sunset tour exceeded all expectations. Watching the golden light hit those ancient walls was breathtaking.",
    author: "Sophie D., Paris",
  },
  {
    quote: "Our guide knew every corner, every story. My kids were fascinated the entire time. Perfect family experience.",
    author: "David H., Chicago",
  },
  {
    quote: "I've done tours all over Europe. This Colosseum experience was hands down the most professional and informative.",
    author: "Yuki T., Tokyo",
  },
  {
    quote: "Worth every penny. The VIP access let us explore areas most tourists never see. Absolutely recommend.",
    author: "Linda W., Amsterdam",
  }
];

export default function TestimonialCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="testimonial-carousel">
      <blockquote>
        "{testimonials[active].quote}"
      </blockquote>
      <div className="testimonial-carousel-author">
        — {testimonials[active].author}
      </div>
      <div className="testimonial-carousel-dots">
        {testimonials.map((_, i) => (
          <button
            key={i}
            className={
              "testimonial-carousel-dot" + (i === active ? " active" : "")
            }
            onClick={() => setActive(i)}
            aria-label={`Show testimonial ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}