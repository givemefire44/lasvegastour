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

    // Por ahora, devolvemos la URL tal como está
    // En producción, podrías validar que la imagen existe, obtener metadatos, etc.
    return NextResponse.json({
      success: 1,
      file: {
        url: url,
        name: url.split('/').pop() || 'image.jpg',
        size: 0,
      }
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    );
  }
} 