// app/components/TourFinder.tsx
'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';

interface Tour { title: string; slug: string; price: number; duration: string; rating: number; reviewCount: number; gygUrl: string; provider: string; image?: string; }
interface Answers { time: string | null; group: string | null; experience: string | null; budget: string | null; }

function parseDurationToMinutes(duration: string | null): number | null {
  if (!duration) return null;
  const d = duration.toLowerCase().trim();
  const hoursMatch = d.match(/([\d.]+)\s*(?:hours?|hrs?|h)/);
  if (hoursMatch) { const h = parseFloat(hoursMatch[1]); const mMatch = d.match(/(\d+)\s*(?:minutes?|mins?|m)/); return Math.round(h * 60 + (mMatch ? parseInt(mMatch[1]) : 0)); }
  const minMatch = d.match(/([\d.]+)\s*(?:minutes?|mins?|m)/);
  if (minMatch) return Math.round(parseFloat(minMatch[1]));
  if (d.includes('full day')) return 480;
  if (d.includes('half day')) return 240;
  const rangeMatch = d.match(/([\d.]+)\s*-\s*([\d.]+)\s*(?:hours?|hrs?)/);
  if (rangeMatch) return Math.round(((parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2) * 60);
  return null;
}

function classifyTour(title: string) {
  const t = title.toLowerCase();
  let tourType = 'standard'; // Museums + Sistine Chapel (+ St. Peter's) = la visita clásica
  if (t.includes('colosseum') || t.includes('colosseo')) tourType = 'combo-colosseum';
  else if (t.includes('dome') || t.includes('cupola')) tourType = 'dome';
  else if ((t.includes("st. peter") || t.includes('st peter') || t.includes('saint peter') || t.includes("peter's") || t.includes('basilica')) && !t.includes('museum') && !t.includes('sistine')) tourType = 'basilica';
  else if (t.includes('early') || t.includes('before opening') || t.includes('first entry') || t.includes('breakfast')) tourType = 'early';
  else if (t.includes('night') || t.includes('evening') || t.includes('after hours')) tourType = 'night';

  let format = 'guided';
  if (t.includes('audio')) format = 'audio-guide';
  else if (t.includes('private') || t.includes('vip') || t.includes('exclusive')) format = 'private';
  else if (t.includes('self-guided')) format = 'self-guided';

  let groupSize = 'standard';
  if (t.includes('small group') || t.includes('small-group') || t.match(/max\s*\d/)) groupSize = 'small-group';
  else if (t.includes('private') || t.includes('vip') || t.includes('exclusive')) groupSize = 'private';

  return { tourType, format, groupSize };
}

function formatDuration(d: string | null): string {
  if (!d) return '';
  const mins = parseDurationToMinutes(d);
  if (!mins) return d;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatReviewCount(c: number): string { return c >= 1000 ? `${(c / 1000).toFixed(1)}k` : c.toString(); }

const STEPS = [
  { id: 'time', label: 'Time', icon: '🕐' },
  { id: 'experience', label: 'Experience', icon: '🏛️' },
  { id: 'group', label: 'Group', icon: '👥' },
  { id: 'budget', label: 'Budget', icon: '💰' },
];

const QUESTIONS: Record<string, { title: string; subtitle: string; options: { value: string; label: string; desc: string; icon: string }[] }> = {
  time: {
    title: 'How much time do you have?',
    subtitle: 'This helps us match the right tour length for your schedule.',
    options: [
      { value: 'quick', label: '1–2 hours', desc: 'A focused visit', icon: '⚡' },
      { value: 'half', label: 'Half day', desc: '3–4 hours to explore', icon: '🕐' },
      { value: 'full', label: 'Full day', desc: 'Combine with other sites', icon: '☀️' },
    ],
  },
  experience: {
    title: 'What kind of experience?',
    subtitle: 'From the classic visit to special access.',
    options: [
      { value: 'basic', label: 'The classic Vatican visit', desc: 'Museums, Sistine Chapel & St. Peter\'s', icon: '🏛️' },
      { value: 'early', label: 'Beat the crowds', desc: 'Early entry before general admission', icon: '🌅' },
      { value: 'dome', label: 'St. Peter\'s & Dome climb', desc: 'Basilica plus panoramic cupola views', icon: '⛪' },
      { value: 'combo', label: 'Vatican + Colosseum in one day', desc: 'Rome\'s two icons, one trip', icon: '🏟️' },
    ],
  },
  group: {
    title: 'Who\'s coming with you?',
    subtitle: 'We\'ll find tours that fit your group.',
    options: [
      { value: 'couple', label: 'Solo or couple', desc: 'Just us', icon: '👫' },
      { value: 'family', label: 'Family with kids', desc: 'Kid-friendly options', icon: '👨‍👩‍👧‍👦' },
      { value: 'friends', label: 'Group of friends', desc: 'Fun group experience', icon: '👥' },
      { value: 'private', label: 'Private experience', desc: 'Just our group, our pace', icon: '🎩' },
    ],
  },
  budget: {
    title: 'What about budget?',
    subtitle: 'Pick the option that fits how you want to spend.',
    options: [
      { value: 'value', label: 'Best value', desc: 'Great experience, smart price', icon: '💚' },
      { value: 'flexible', label: 'I\'m flexible', desc: 'Show me the best-rated', icon: '⭐' },
      { value: 'premium', label: 'Money is not an issue', desc: 'VIP and private options', icon: '💎' },
    ],
  },
};

function filterTours(tours: Tour[], answers: Answers): Tour[] {
  let filtered = tours.filter(t => t.price > 0 && t.rating > 0);
  const classified = filtered.map(t => ({ ...t, ...classifyTour(t.title), minutes: parseDurationToMinutes(t.duration) }));
  let results = classified;
  if (answers.time === 'quick') results = results.filter(t => t.minutes && t.minutes <= 150);
  else if (answers.time === 'half') results = results.filter(t => t.minutes && t.minutes > 90 && t.minutes <= 300);
  else if (answers.time === 'full') results = results.filter(t => (t.minutes && t.minutes > 240) || t.tourType === 'combo-colosseum');
  if (answers.group === 'family') results = results.filter(t => t.tourType !== 'night');
  else if (answers.group === 'private') results = results.filter(t => t.format === 'private');
  if (answers.experience === 'basic') results = results.filter(t => t.tourType === 'standard');
  else if (answers.experience === 'early') results = results.filter(t => t.tourType === 'early');
  else if (answers.experience === 'dome') results = results.filter(t => t.tourType === 'dome' || t.tourType === 'basilica');
  else if (answers.experience === 'combo') results = results.filter(t => t.tourType === 'combo-colosseum');
  if (answers.budget === 'value') results.sort((a, b) => ((b.rating || 0) * 10 - b.price / 20) - ((a.rating || 0) * 10 - a.price / 20));
  else if (answers.budget === 'flexible') results.sort((a, b) => (b.rating !== a.rating) ? (b.rating || 0) - (a.rating || 0) : (b.reviewCount || 0) - (a.reviewCount || 0));
  else if (answers.budget === 'premium') results.sort((a, b) => b.price - a.price);
  const seen = new Set<string>();
  results = results.filter(t => { const id = t.gygUrl.match(/t(\d+)/)?.[1] || t.gygUrl; if (seen.has(id)) return false; seen.add(id); return true; });
  return results.slice(0, 3);
}

function getWhyText(tour: any, answers: Answers): string {
  const p: string[] = [];
  if (answers.experience === 'early' && tour.tourType === 'early') p.push('Early entry means you see the Sistine Chapel before the crowds arrive');
  else if (answers.experience === 'dome' && (tour.tourType === 'dome' || tour.tourType === 'basilica')) p.push('Includes St. Peter\'s Basilica with the option to climb the dome');
  else if (answers.experience === 'combo' && tour.tourType === 'combo-colosseum') p.push('Covers the Vatican and the Colosseum in one efficient day');
  else if (answers.experience === 'basic' && tour.tourType === 'standard') p.push('Covers the Vatican Museums, Sistine Chapel, and St. Peter\'s Basilica');
  if (answers.group === 'private' && tour.format === 'private') p.push('Private tour at your pace');
  if (tour.reviewCount >= 1000) p.push(`${formatReviewCount(tour.reviewCount)} verified reviews`);
  if (tour.rating >= 4.8) p.push(`${tour.rating}/5 rating`);
  return p.join('. ') + '.';
}

export default function TourFinder({ tours }: { tours: Tour[] }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ time: null, group: null, experience: null, budget: null });
  const [showResults, setShowResults] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const stepKeys: (keyof Answers)[] = ['time', 'experience', 'group', 'budget'];
  const currentStepId = STEPS[step]?.id || 'time';
  const currentQuestion = QUESTIONS[currentStepId];

  const handleSelect = (value: string) => {
    setAnswers({ ...answers, [stepKeys[step]]: value });
    setTimeout(() => { if (step < STEPS.length - 1) setStep(step + 1); else setShowResults(true); }, 300);
  };
  const handleStepClick = (idx: number) => { if (idx < step) { setStep(idx); setShowResults(false); } };
  const handleRestart = () => { setStep(0); setAnswers({ time: null, group: null, experience: null, budget: null }); setShowResults(false); };

  const results = useMemo(() => showResults ? filterTours(tours, answers) : [], [showResults, tours, answers]);
  const fallbackResults = useMemo(() => {
    if (results.length > 0) return results;
    const sorted = [...tours].filter(t => t.price > 0 && t.rating > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const seen = new Set<string>();
    return sorted.filter(t => { const id = t.gygUrl.match(/t(\d+)/)?.[1] || t.gygUrl; if (seen.has(id)) return false; seen.add(id); return true; })
      .slice(0, 3).map(t => ({ ...t, ...classifyTour(t.title), minutes: parseDurationToMinutes(t.duration) }));
  }, [results, tours]);
  const displayResults = results.length > 0 ? results : fallbackResults;

  return (
    <div style={{
      maxWidth: '1000px', margin: '0 auto',
      padding: isMobile ? '24px 16px 16px 16px' : '40px 20px 20px 20px',
      background: '#fdf6f8', borderRadius: isMobile ? '0' : '20px',
    }}>

      {/* HEADER */}
      <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '32px' }}>
        <h1 style={{
          fontSize: isMobile ? '1.5rem' : 'clamp(1.8rem, 4vw, 2.6rem)',
          fontWeight: 800, color: '#1a1a1a', marginBottom: '10px', lineHeight: 1.15,
        }}>
          Let&#39;s find your <span style={{ color: '#e91e63', fontStyle: 'italic' }}>perfect</span> Vatican tour
        </h1>
        <p style={{ fontSize: isMobile ? '0.95rem' : '1.1rem', color: '#555', maxWidth: '520px', margin: '0 auto' }}>
          Answer 4 simple questions and we&#39;ll show you the best tours for you.
        </p>
      </div>

      {/* STEP TABS */}
      {!showResults && (
        <div style={{
          display: 'flex', alignItems: 'center', background: '#fff', borderRadius: '12px',
          padding: '4px', marginBottom: isMobile ? '20px' : '28px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e8e0e3',
          overflowX: isMobile ? 'auto' : 'visible',
        }}>
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isDone = i < step;
            return (
              <button key={s.id} onClick={() => handleStepClick(i)} style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px',
                flex: isMobile ? 'none' : 1, justifyContent: 'center',
                padding: isMobile ? '10px 12px' : '12px 16px', border: 'none',
                borderRadius: '10px',
                background: isActive ? '#e91e63' : 'transparent',
                cursor: isDone ? 'pointer' : 'default',
                opacity: i > step ? 0.5 : 1,
                transition: 'all 0.2s', whiteSpace: 'nowrap',
              }}>
                <span style={{
                  width: isMobile ? '22px' : '26px', height: isMobile ? '22px' : '26px',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isMobile ? '0.65rem' : '0.75rem', fontWeight: 800,
                  background: isActive ? '#fff' : isDone ? '#4caf50' : '#d0d0d0',
                  color: isActive ? '#e91e63' : '#fff',
                }}>
                  {isDone ? '✓' : i + 1}
                </span>
                <span style={{
                  fontSize: isMobile ? '0.78rem' : '0.9rem',
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? '#fff' : isDone ? '#333' : '#999',
                }}>
                  {s.label}
                </span>
              </button>
            );
          })}
          {!isMobile && (
            <span style={{ padding: '0 16px', fontSize: '0.78rem', color: '#e91e63', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {Math.round(((step + 1) / STEPS.length) * 100)}%
            </span>
          )}
        </div>
      )}

      {/* QUIZ + SIDEBAR */}
      {!showResults && currentQuestion && (
        <div style={{
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 300px',
          gap: '24px', alignItems: 'start',
        }}>

          {/* LEFT: QUESTION */}
          <div style={{
            background: '#fff', border: '2px solid #e0d6d9', borderRadius: '16px',
            padding: isMobile ? '20px 16px' : '28px 28px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px', marginBottom: '6px' }}>
              <span style={{
                width: isMobile ? '38px' : '46px', height: isMobile ? '38px' : '46px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isMobile ? '1.2rem' : '1.5rem', background: '#fce4ec', border: '2px solid #f8bbd0',
              }}>{STEPS[step].icon}</span>
              <h2 style={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{currentQuestion.title}</h2>
            </div>
            <p style={{
              fontSize: isMobile ? '0.82rem' : '0.88rem', color: '#777',
              marginBottom: isMobile ? '16px' : '20px',
              marginLeft: isMobile ? '48px' : '60px',
            }}>{currentQuestion.subtitle}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '10px' }}>
              {currentQuestion.options.map(option => {
                const selected = answers[stepKeys[step]] === option.value;
                return (
                  <button key={option.value} onClick={() => handleSelect(option.value)} style={{
                    display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '14px', width: '100%',
                    padding: isMobile ? '12px 14px' : '14px 16px',
                    border: selected ? '2px solid #e91e63' : '2px solid #e8e0e3',
                    borderRadius: '12px',
                    background: selected ? '#fce4ec' : '#fafaf8',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    boxShadow: selected ? '0 4px 14px rgba(233,30,99,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                  }}>
                    <span style={{
                      width: isMobile ? '38px' : '44px', height: isMobile ? '38px' : '44px',
                      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isMobile ? '1rem' : '1.2rem', flexShrink: 0,
                      background: selected ? '#e91e63' : '#f0ecee',
                      border: selected ? 'none' : '2px solid #ddd',
                      transition: 'all 0.15s',
                    }}>
                      {selected ? <span style={{ color: '#fff', fontSize: '1.1rem' }}>✓</span> : option.icon}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: isMobile ? '0.95rem' : '1.05rem', color: '#1a1a1a', marginBottom: '1px' }}>{option.label}</div>
                      <div style={{ fontSize: isMobile ? '0.78rem' : '0.83rem', color: '#888' }}>{option.desc}</div>
                    </div>
                    <span style={{ color: '#bbb', fontSize: '22px', flexShrink: 0, fontWeight: 300 }}>&#8250;</span>
                  </button>
                );
              })}
            </div>

            {/* BACK + HELPER TEXT */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: step > 0 ? 'space-between' : 'center',
              marginTop: isMobile ? '14px' : '18px',
              flexWrap: 'wrap', gap: '8px',
            }}>
              {step > 0 && (
                <button onClick={() => { setStep(step - 1); setShowResults(false); }} style={{
                  padding: '8px 18px', background: '#f5f5f5', border: '1px solid #ddd',
                  borderRadius: '8px', color: '#555', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600,
                }}>&#8592; Back</button>
              )}
              <span style={{ fontSize: '0.82rem', color: '#888' }}>
                &#9201; Takes 30 seconds
              </span>
            </div>
          </div>

          {/* RIGHT: SIDEBAR — desktop only */}
          {!isMobile && (
            <div style={{ position: 'sticky', top: '20px' }}>
              <div style={{
                borderRadius: '16px', overflow: 'hidden',
                border: '2px solid #e0d6d9', boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
                background: '#fff',
              }}>
                {tours[0]?.image && (
                  <img
                    src={`${tours[0].image}?w=400&h=220&fit=crop&auto=format`}
                    alt="Vatican, Rome"
                    style={{ width: '100%', height: '190px', objectFit: 'cover', display: 'block' }}
                  />
                )}
                <div style={{ padding: '20px 18px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#e91e63', marginBottom: '18px' }}>Why this helps</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {[
                      { icon: '🎯', bg: '#e8f5e9', border: '#c8e6c9', title: 'Personalized', desc: 'We match tours to your preferences' },
                      { icon: '⭐', bg: '#fff8e1', border: '#ffe082', title: 'Top-rated', desc: 'Only highly rated tours' },
                      { icon: '✅', bg: '#e3f2fd', border: '#90caf9', title: 'Trusted', desc: 'Partnered with GetYourGuide' },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1rem', flexShrink: 0, background: item.bg, border: `2px solid ${item.border}`,
                        }}>{item.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1a1a1a' }}>{item.title}</div>
                          <div style={{ fontSize: '0.76rem', color: '#888' }}>{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RESULTS */}
      {showResults && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: isMobile ? '1.3rem' : '1.7rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '12px' }}>
              {results.length > 0 ? `We found ${displayResults.length} perfect matches` : 'Here are our top recommendations'}
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
              {STEPS.map((s, i) => {
                const answer = answers[stepKeys[i]];
                const option = QUESTIONS[s.id].options.find(o => o.value === answer);
                if (!option) return null;
                return (
                  <span key={s.id} style={{
                    padding: isMobile ? '4px 10px' : '6px 14px',
                    background: '#fff', border: '2px solid #e91e63',
                    borderRadius: '20px', fontSize: isMobile ? '0.72rem' : '0.82rem',
                    color: '#c2185b', fontWeight: 600,
                  }}>
                    {option.icon} {option.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px', maxWidth: '800px', margin: '0 auto 30px auto' }}>
            {displayResults.map((tour, i) => (
              <div key={tour.slug} style={{
                border: i === 0 ? '2px solid #e91e63' : '2px solid #e0d6d9',
                borderRadius: '16px', overflow: 'hidden', background: '#fff',
                boxShadow: i === 0 ? '0 8px 28px rgba(233,30,99,0.12)' : '0 2px 10px rgba(0,0,0,0.05)',
              }}>
                {i === 0 && (
                  <div style={{
                    background: '#e91e63', color: '#fff',
                    padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700,
                    textAlign: 'center', letterSpacing: '0.5px', textTransform: 'uppercase',
                  }}>
                    &#127942; Best Match for You
                  </div>
                )}
                <div style={{
                  padding: isMobile ? '16px' : '24px',
                  display: isMobile ? 'block' : 'flex',
                  gap: '20px',
                }}>
                  {/* Image — visible en mobile (apilada) y desktop (al costado) */}
                  {tour.image && (
                    <img
                      src={`${tour.image}?w=${isMobile ? 600 : 180}&h=${isMobile ? 200 : 140}&fit=crop&auto=format`}
                      alt={tour.title}
                      style={{
                        width: isMobile ? '100%' : '180px',
                        height: isMobile ? '180px' : '140px',
                        objectFit: 'cover',
                        borderRadius: '10px', flexShrink: 0,
                        display: 'block',
                        marginBottom: isMobile ? '14px' : 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      fontSize: isMobile ? '1rem' : '1.15rem', fontWeight: 700,
                      color: '#1a1a1a', marginBottom: '10px', lineHeight: 1.3,
                    }}>{tour.title}</h3>
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: isMobile ? '8px' : '16px',
                      marginBottom: '12px', fontSize: isMobile ? '0.82rem' : '0.9rem', color: '#555',
                    }}>
                      <span>&#11088; {tour.rating}/5 ({formatReviewCount(tour.reviewCount)})</span>
                      <span>&#128176; ${tour.price}</span>
                      {tour.duration && <span>&#9202; {formatDuration(tour.duration)}</span>}
                    </div>
                    <p style={{
                      fontSize: isMobile ? '0.82rem' : '0.88rem', color: '#555', lineHeight: 1.5,
                      marginBottom: '14px', padding: '8px 12px', background: '#fdf6f8',
                      borderRadius: '8px', borderLeft: '3px solid #e91e63',
                    }}>{getWhyText(tour, answers)}</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <a href={tour.gygUrl} target="_blank" rel="noopener noreferrer" style={{
                        display: 'inline-block', padding: isMobile ? '10px 16px' : '12px 24px',
                        background: '#e11d48',color: '#fff',
                        borderRadius: '8px', fontWeight: 700,
                        fontSize: isMobile ? '0.85rem' : '0.95rem',
                        textDecoration: 'none', textAlign: 'center', flex: 1, minWidth: '120px',
                      }}>Check Availability</a>
                      <Link href={`/tour/${tour.slug}`} style={{
                        display: 'inline-block', padding: isMobile ? '10px 16px' : '12px 24px',
                        background: '#fff', color: '#e91e63',
                        border: '2px solid #e91e63', borderRadius: '8px', fontWeight: 600,
                        fontSize: isMobile ? '0.85rem' : '0.95rem',
                        textDecoration: 'none', textAlign: 'center', flex: 1, minWidth: '120px',
                      }}>Read Full Review</Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleRestart} style={{
              padding: '12px 28px', background: '#fff', border: '2px solid #e91e63', color: '#e91e63',
              borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem',
            }}>Start Over</button>
            <Link href="/tours/vatican-tours" style={{
              padding: '12px 28px', background: '#f5f5f5', border: '2px solid #ddd', color: '#555',
              borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '0.95rem',
            }}>Browse All Tours</Link>
          </div>
        </div>
      )}

      {/* SOCIAL PROOF */}
      <div style={{
        marginTop: isMobile ? '24px' : '36px',
        padding: isMobile ? '12px 16px' : '14px 24px',
        background: '#fff', borderRadius: '12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: isMobile ? '10px' : '14px', flexWrap: 'wrap',
        border: '2px solid #e8e0e3', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex' }}>
          {['🇺🇸', '🇬🇧', '🇦🇺', '🇨🇦', '🇩🇪'].map((flag, i) => (
            <span key={i} style={{
              width: isMobile ? '26px' : '32px', height: isMobile ? '26px' : '32px',
              borderRadius: '50%', border: '2px solid #fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isMobile ? '13px' : '16px', marginLeft: i > 0 ? '-8px' : '0',
              background: '#f5f0f2', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>{flag}</span>
          ))}
        </div>
        <span style={{ fontSize: isMobile ? '0.78rem' : '0.9rem', color: '#444', fontWeight: 600, textAlign: 'center' }}>
          Join 25,000+ travelers who found their perfect tour
        </span>
        <span style={{ color: '#f5a623', letterSpacing: '2px', fontSize: isMobile ? '0.9rem' : '1.1rem' }}>&#9733;&#9733;&#9733;&#9733;&#9733;</span>
      </div>
    </div>
  );
}

