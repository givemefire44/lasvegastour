"use client";
import React, { useState, useEffect } from "react";

const testimonials = [
  {
    quote: "The Sphere is unlike anything I've ever seen. Postcard from Earth genuinely left me speechless — the resolution and the sound make you forget you're looking at a screen.",
    author: "Jason M., Dallas",
  },
  {
    quote: "We saw 'O' for our anniversary and both of us teared up. The acrobatics over water just don't translate on video; you have to be in the room.",
    author: "Priya & Sam, Chicago",
  },
  {
    quote: "Flew over the Strip at night before dinner. Twenty minutes we'll be talking about for years. The pilot pointed out every casino as we passed.",
    author: "Megan R., Denver",
  },
  {
    quote: "The Hoover Dam tour was far more interesting than I expected. The engineering side fascinated my teenage son, who normally hates everything.",
    author: "Tom B., Seattle",
  },
  {
    quote: "Booked the Antelope Canyon and Horseshoe Bend day trip on a whim. Long drive, but those slot canyons are worth every minute in the van.",
    author: "Carla D., Phoenix",
  },
  {
    quote: "Helicopter down into the Grand Canyon and a champagne toast at the bottom. My wife said it was the best thing we've ever done together.",
    author: "Andre L., Atlanta",
  },
  {
    quote: "Skip-the-line on the Strip food tour meant we tasted nine places in three hours without standing around. Came hungry, left stuffed.",
    author: "Hannah W., Boston",
  },
  {
    quote: "KÀ blew my mind. The rotating stage alone is worth the ticket. My kids, 9 and 12, were glued to their seats the whole time.",
    author: "Derek S., Houston",
  },
  {
    quote: "Did the morning ATV ride through the Mojave. Dusty, loud, and an absolute blast. The guides kept it safe but still let us open it up.",
    author: "Luis G., Miami",
  },
  {
    quote: "Red Rock Canyon at sunrise was the calm counterweight to all the neon. Twenty minutes from the Strip and it feels like another planet.",
    author: "Sophie T., London",
  },
  {
    quote: "Valley of Fire surprised me. The red rock formations photograph incredibly, and our small group meant we never felt rushed.",
    author: "Rachel K., Portland",
  },
  {
    quote: "The club crawl took the guesswork out of the night. Skipped every line, four venues, and a host who actually knew the bartenders.",
    author: "Marcus J., Nashville",
  },
  {
    quote: "Grand Canyon West with the Skywalk — standing on glass over the canyon is terrifying in the best way. Worth the early start.",
    author: "Nicole P., Minneapolis",
  },
  {
    quote: "Death Valley in a small group was a bucket-list day. Brutal heat, otherworldly landscapes, and a guide who knew exactly where to stop.",
    author: "Greg H., San Diego",
  },
  {
    quote: "Took the gondola ride and a guided Strip walk. Touristy? Sure. Did we love every cheesy second? Also yes.",
    author: "Emma & Jack, Manchester",
  },
  {
    quote: "The pool party day pass was exactly the scene we wanted. Got us in past the line and near the DJ without the usual hassle.",
    author: "Tyler R., Austin",
  },
  {
    quote: "The magic show had us arguing in the car the whole way back about how he did it. Still no idea. Brilliant night.",
    author: "Olivia M., Toronto",
  },
  {
    quote: "South Rim by bus was a long day but beautifully run. Lunch was included and better than expected, and the viewpoints just kept improving.",
    author: "Frank D., Kansas City",
  },
  {
    quote: "Helicopter to the canyon floor, then a quiet picnic by the Colorado River. Felt a million miles from the casinos.",
    author: "Ana C., Madrid",
  },

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
