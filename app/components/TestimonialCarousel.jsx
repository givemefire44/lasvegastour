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
  {
    quote: "Hoover Dam plus Lake Mead in one trip. Efficient, scenic, and our guide had a dry sense of humor that made the drive fly by.",
    author: "Steve W., Cleveland",
  },
  {
    quote: "Booked a private tour for my parents' 40th. The flexibility to go at their pace made all the difference. Going private was the right call.",
    author: "Jessica L., Vancouver",
  },
  {
    quote: "The sunset desert tour ended with the sky going pink over the mountains. Quiet, unhurried, the opposite of the Strip in the best way.",
    author: "Daniel F., Dublin",
  },
  {
    quote: "Traveling with my mom, who uses a wheelchair, I was nervous. The team handled accessibility without any fuss and we had a perfect day.",
    author: "Renee A., Sacramento",
  },
  {
    quote: "Booked the Sphere two hours before showtime after seeing it from our hotel. So glad we did — the visuals alone are worth the trip to Vegas.",
    author: "Kevin O., Phoenix",
  },
  {
    quote: "An energetic stage show, no dialogue, all spectacle. My in-laws don't speak much English and they laughed the entire time.",
    author: "Mei L., Auckland",
  },
  {
    quote: "Off-road Hummer through the desert was rough, dusty, and the most fun I've had in years. Book it if you don't mind getting filthy.",
    author: "Brandon T., Tampa",
  },
  {
    quote: "Ziplined over Fremont Street at night. Flying through all that light with the bands playing below — pure Vegas chaos, and I loved it.",
    author: "Chloe R., Glasgow",
  },
  {
    quote: "The Grand Canyon West Rim day trip ran like clockwork. Pickup on time, a knowledgeable driver, and plenty of time at each lookout.",
    author: "Patricia M., Denver",
  },
  {
    quote: "Combining Hoover Dam and the Grand Canyon in one day is ambitious, but they made it work. Tiring, but we saw everything we wanted.",
    author: "Eric S., Salt Lake City",
  },
  {
    quote: "The downtown and Las Vegas sign tour was a fun half-day. Got the classic photo without circling for parking for an hour.",
    author: "Whitney B., Charlotte",
  },
  {
    quote: "Seven Magic Mountains was a quick, colorful stop on our day trip. Strange and wonderful, out in the middle of the desert.",
    author: "Hiroshi K., Osaka",
  },
  {
    quote: "Mystère is the original Cirque show and it still holds up. Funny, gorgeous, and great for a first-timer who isn't sure what to expect.",
    author: "Laura G., Bristol",
  },
  {
    quote: "VIP table for my brother's bachelor party. The host sorted everything so we could just enjoy it. Worth splitting the cost.",
    author: "Nick V., Philadelphia",
  },
  {
    quote: "Romantic helicopter flight for our engagement. The pilot quietly looped back over the Strip so I could propose mid-air. She said yes.",
    author: "Adam P., Columbus",
  },
  {
    quote: "Multi-day road trip from Vegas through Zion and Bryce. Exhausting in the best way — we packed in more than I thought was possible.",
    author: "Sandra H., Calgary",
  },
  {
    quote: "First time in Vegas and overwhelmed by the options, so we booked a guided overview day. Best decision — it helped us plan the rest of the trip.",
    author: "Yusuf A., Birmingham",
  },
  {
    quote: "Watched the Grand Canyon light up at sunrise on a small-group tour. Cold, early, and completely worth dragging myself out of bed.",
    author: "Bethany R., Indianapolis",
  },
  {
    quote: "The food tour took us off the Strip to spots we'd never have found on our own. Best tacos of my life, in a strip mall of all places.",
    author: "Carlos M., San Antonio",
  },
  {
    quote: "Booked the Sphere for the whole family of six. Even my phone-addicted teenagers put their screens away. That's the real review.",
    author: "Dana W., Omaha",
  },
  {
    quote: "Did a sunset ATV ride and stayed for the stargazing. Away from the lights, the desert sky is unreal. A side of Vegas I didn't expect.",
    author: "Ingrid S., Stockholm",
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
