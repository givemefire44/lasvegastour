import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: 'No URL provided' },
        { status: 400 }
      );
    }

    // Validar que es una URL válida
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    // Por ahora, devolvemos metadatos básicos
    // En producción, podrías hacer scraping de la página para obtener título, descripción, etc.
    const domain = new URL(url).hostname;
    
    return NextResponse.json({
      success: 1,
      meta: {
        title: domain,
        description: `Link to ${domain}`,
        image: {
          url: `https://via.placeholder.com/400x200/cccccc/666666?text=${encodeURIComponent(domain)}`
        }
      }
    });
  } catch (error) {
    console.error('Error fetching link:', error);
    return NextResponse.json(
      { error: 'Failed to fetch link metadata' },
      { status: 500 }
    );
  }
} 