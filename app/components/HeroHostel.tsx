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
            {
              text: "Helicopters",
              image: "https://cdn.sanity.io/images/kabmqky1/production/2d8842ecf39889552918cbf3b6a40594c127d601-720x480.jpg?w=240&h=240&fit=crop&auto=format",
              href: "/tours/helicopter-tours",
            },
            {
              text: "Grand Canyon",
              image: "https://cdn.sanity.io/images/kabmqky1/production/06136dc7367c352deeca6eda9e3a7617b1819b64-720x480.jpg?w=240&h=240&fit=crop&auto=format",
              href: "/tours/grand-canyon-tours",
            },
            {
              text: "Cirque Soleil",
              image: "https://cdn.sanity.io/images/kabmqky1/production/7ad0423780c6aae9587ab63adafc547574194425-720x480.jpg?w=240&h=240&fit=crop&auto=format",
              href: "/cirque-du-soleil-shows-las-vegas",
            },
            {
              text: "Sphere",
              image: "https://cdn.sanity.io/images/kabmqky1/production/c0a533a1bca4e6ace7b5478664d48e0e11b2512f-720x480.jpg?w=240&h=240&fit=crop&auto=format",
              href: "/sphere-las-vegas-shows",
            },
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
              background: 'rgba(0, 0, 0, 0.42)',
              padding: '1px 12px',
              borderRadius: '5px',
              lineHeight: '1.25',
              display: 'inline-block',
            }}
          >
            Not sure which tour? Find yours in 30 seconds
          </a>
        </div>
      </div>
    </section>
  );
}