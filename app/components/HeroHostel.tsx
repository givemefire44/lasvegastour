import BubbleComments from "../components/BubbleComments";
import CitySearch from "../components/CitySearch";
export default function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-container">
        <h1 className="hero-title"> Choose the Right Las Vegas Experience</h1>
        <h2 className="hero-subtitle">
        We don't describe tours. We explain decisions.
        </h2>
        <BubbleComments
          comments={[
            { text: "Day Tour?" },
            { text: "Book Tickets!" },
            { text: "Grand Canyon today?" },
            { text: "Helicopter tour?" }
          ]}
        />
        <div className="city-search-container">
          <CitySearch />
        </div>
        <div className="cancellation-text">
          Flexible Booking and Free Cancellation
        </div>
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <a
            href="/tour-finder"
            style={{
              color: '#FFD700',
              fontSize: '0.95rem',
              fontWeight: 700,
              textDecoration: 'none',
              textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          >
            Not sure which tour? Find yours in 30 seconds
          </a>
        </div>
      </div>
    </section>
  );
}