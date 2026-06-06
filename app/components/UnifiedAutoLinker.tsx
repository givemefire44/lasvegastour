'use client';

import { useState, useEffect, isValidElement, cloneElement } from 'react';
import { addAutoLinks } from '../utils/autoLinker';

function linkifyUrls(text: string): string {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  
  text = text.replace(urlRegex, (url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 500;">${url}</a>`;
  });
  
  text = text.replace(emailRegex, (email) => {
    return `<a href="mailto:${email}" style="color: #2563eb; text-decoration: underline; font-weight: 500;">${email}</a>`;
  });
  
  return text;
}

interface UnifiedAutoLinkerProps {
  children: any;
  pageSlug?: string;
  pageType?: 'tour' | 'article' | 'hub';
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  as?: 'p' | 'div';  // 🆕 permite elegir el tag
}

function hasExistingLinks(children: any): boolean {
  if (!children) return false;
  if (typeof children === 'string') {
    return children.includes('<a ') || children.includes('</a>') || children.includes('href=');
  }
  if (isValidElement(children) && (children as any).type === 'a') return true;
  if (Array.isArray(children)) return children.some(child => hasExistingLinks(child));
  if (isValidElement(children)) {
    const element = children as React.ReactElement<{ children?: any }>;
    if (element.props.children) return hasExistingLinks(element.props.children);
  }
  return false;
}

function ProcessedParagraph({ 
  children, 
  pageSlug,
  pageType,
  className, 
  style,
  as: Tag = 'p'  // 🆕 tag configurable
}: { 
  children: any; 
  pageSlug?: string;
  pageType?: 'tour' | 'article' | 'hub';
  className: string; 
  style: React.CSSProperties;
  as?: 'p' | 'div';
}) {
  const [processedChildren, setProcessedChildren] = useState<any>(children);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const processChildren = async () => {
      try {
        const result = await processReactChildren(children, pageSlug, pageType);
        setProcessedChildren(result);
      } catch (error) {
        console.error('⚠️ AutoLinker error:', error);
        setProcessedChildren(children);
      }
    };
    processChildren();
  }, [isClient, pageSlug, pageType]);

  // SSR y cliente usan el mismo Tag — sin mismatch de estructura
  return (
    <Tag className={className} style={style} suppressHydrationWarning>
      {isClient ? processedChildren : children}
    </Tag>
  );
}

async function processReactChildren(
  children: any, 
  pageSlug?: string, 
  pageType?: 'tour' | 'article' | 'hub'
): Promise<any> {
  if (!children) return children;

  if (typeof children === 'string') {
    if (children.trim().length === 0) return children;
    if (children.includes('<a ') || children.includes('href=')) return children;

    let result = linkifyUrls(children);
    const hasUrls = result.includes('<a href');

    if (!hasUrls) {
      result = await addAutoLinks(
        children,
        { maxLinksPerPage: 12, maxLinksPerKeyword: 2, maxDensity: 2.0, minWordsBetween: 80 },
        { tourSlug: pageSlug, pageType }
      );
    }

    if (result !== children) {
      return <span dangerouslySetInnerHTML={{ __html: result }} />;
    }
    return children;
  }

  if (Array.isArray(children)) {
    const processed = await Promise.all(
      children.map(child => processReactChildren(child, pageSlug, pageType))
    );
    return processed;
  }

  if (isValidElement(children)) {
    const element = children as React.ReactElement<any>;
    if ((element.type as any) === 'a') return children;
    if (element.props.children) {
      const processedInner = await processReactChildren(element.props.children, pageSlug, pageType);
      return cloneElement(element, {}, processedInner);
    }
    return children;
  }

  return children;
}

export default function UnifiedAutoLinker({
  children,
  pageSlug,
  pageType,
  className = 'content-paragraph',
  style = {},
  disabled = false,
  as = 'p'
}: UnifiedAutoLinkerProps) {

  if (disabled || hasExistingLinks(children)) {
    const Tag = as;
    return <Tag className={className} style={style}>{children}</Tag>;
  }

  return (
    <ProcessedParagraph
      pageSlug={pageSlug}
      pageType={pageType}
      className={className}
      style={style}
      as={as}
    >
      {children}
    </ProcessedParagraph>
  );
}

export const autoLinkerStyles = `
  .auto-link {
    color: #8816c0;
    text-decoration: none;
    border-bottom: none;
    transition: color 0.2s ease;
  }
  .auto-link:hover { color: #6b21a8; }
  .auto-link:visited { color: #6b46c1; }
  .sanity-sync-link { text-decoration: none; border-bottom: none; background: none; }
  .sanity-sync-link:hover { text-decoration: none; border-bottom: none; }
  .sanity-sync-link::after { display: none; }
  .content-paragraph.processing { opacity: 0.8; transition: opacity 0.3s ease; }
`;

