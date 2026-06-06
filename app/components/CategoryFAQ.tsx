'use client';

import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

interface CategoryFAQProps {
  faqs: FAQItem[];
}

export default function CategoryFAQ({ faqs }: CategoryFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div style={{ 
      background: '#f9fafb',
      padding: '60px 0'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 20px'
      }}>
        <h2 style={{
          fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
          fontWeight: '700',
          marginBottom: '40px',
          color: '#1f2937',
          textAlign: 'center'
        }}>
          Frequently Asked Questions
        </h2>
        
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {faqs.map((faq, index) => (
            <div 
              key={index}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'box-shadow 0.2s ease'
              }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                style={{
                  width: '100%',
                  padding: '20px 24px',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  gap: '20px'
                }}
                aria-expanded={openIndex === index}
              >
                <h3 style={{ 
                  fontSize: 'clamp(1rem, 2vw, 1.125rem)',
                  fontWeight: '600',
                  color: '#111827',
                  margin: 0,
                  lineHeight: '1.4'
                }}>
                  {faq.question}
                </h3>
                <svg
                  style={{
                    width: '24px',
                    height: '24px',
                    minWidth: '24px',
                    color: '#6b7280',
                    transition: 'transform 0.3s ease',
                    transform: openIndex === index ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              
              <div
                style={{
                  maxHeight: openIndex === index ? '500px' : '0',
                  overflow: 'hidden',
                  transition: 'max-height 0.3s ease'
                }}
              >
                <div style={{ 
                  padding: '0 24px 24px 24px',
                  color: '#4b5563',
                  fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                  lineHeight: '1.6'
                }}>
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ 
          marginTop: '40px',
          textAlign: 'center',
          fontSize: '0.95rem',
          color: '#6b7280'
        }}>
          <p style={{ margin: 0 }}>
            Still have questions?{' '}
            <a 
              href="/contact" 
              style={{ 
                color: '#2563eb',
                textDecoration: 'underline',
                fontWeight: '500'
              }}
            >
              Contact us
            </a>
            {' '}for personalized assistance.
          </p>
        </div>
      </div>
    </div>
  );
}