import { NextRequest, NextResponse } from 'next/server';

// ========================================
// VIATOR API ROUTE
// ========================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchQuery, destination = 'rome' } = body;

    // Validación básica
    if (!searchQuery || searchQuery.trim().length < 2) {
      return NextResponse.json(
        { error: 'Search query is required and must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Configuración de fechas (próximos 3 meses)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3);

    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    // Payload para Viator API (formato correcto para freetext)
    const viatorPayload = {
      searchTerm: searchQuery.trim(),
      productFiltering: {
        dateRange: {
          from: formatDate(startDate),
          to: formatDate(endDate)
        },
        price: {
          from: 0,
          to: 1000
        },
        rating: {
          from: 3, // Solo tours con rating >= 3
          to: 5
        },
        flags: [
          "FREE_CANCELLATION"
        ],
        includeAutomaticTranslations: true
      },
      productSorting: {
        sort: "PRICE",
        order: "ASCENDING"
      },
      searchTypes: [
        {
          searchType: "PRODUCTS",
          pagination: {
            start: 1,
            count: 20
          }
        }
      ],
      currency: "USD"
    };

    console.log('🔍 Searching Viator for:', searchQuery);
    console.log('📡 Viator URL:', 'https://api.viator.com/partner/search/freetext');
    console.log('🔑 API Key:', 'a7089eb8-3017-45f6-ab77-caba1e108771');
    console.log('📦 Payload:', JSON.stringify(viatorPayload, null, 2));

    // Llamada a Viator API
    const viatorResponse = await fetch('https://api.viator.com/partner/search/freetext', {
      method: 'POST',
      headers: {
        'exp-api-key': 'a7089eb8-3017-45f6-ab77-caba1e108771', // API de producción
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json',
        'Accept': 'application/json;version=2.0'
      },
      body: JSON.stringify(viatorPayload)
    });

    if (!viatorResponse.ok) {
      const errorText = await viatorResponse.text();
      console.error('❌ Viator API Error:', viatorResponse.status, errorText);
      
      return NextResponse.json(
        { error: 'Failed to fetch from Viator API', details: errorText },
        { status: viatorResponse.status }
      );
    }

    const viatorData = await viatorResponse.json();
    console.log('✅ Viator API Success:', viatorData.products?.totalCount || 0, 'total tours found');

    // Procesar y formatear resultados para nuestro frontend
    const formattedResults = viatorData.products?.results?.map((product: any) => ({
      id: product.productCode,
      name: product.title,
      slug: product.productCode.toLowerCase(),
      description: product.description || 'No description available',
      duration: product.duration?.fixedDurationInMinutes ? `${Math.round(product.duration.fixedDurationInMinutes / 60)} hours` : 'Variable',
      price: product.pricing?.summary?.fromPrice || 'Price on request',
      currency: product.pricing?.currency || 'USD',
      rating: product.reviews?.combinedAverageRating || 0,
      reviewCount: product.reviews?.totalReviews || 0,
      imageUrl: product.images?.[0]?.variants?.find(v => v.width === 400)?.url || product.images?.[0]?.variants?.[0]?.url || '',
      category: product.itineraryType || 'tour',
      confirmationType: product.confirmationType || 'MANUAL',
      viator_url: product.productUrl || `https://www.viator.com/tours/-/${product.productCode}?pid=P00140156&mcid=42383&medium=api`,
      bookingUrl: product.productUrl || `https://www.viator.com/tours/-/${product.productCode}?pid=P00140156&mcid=42383&medium=api`,
      flags: product.flags || []
    })) || [];

    // Respuesta exitosa
    return NextResponse.json({
      success: true,
      query: searchQuery,
      totalCount: viatorData.products?.totalCount || 0,
      totalResults: formattedResults.length,
      results: formattedResults
    });

  } catch (error) {
    console.error('💥 API Route Error:', error);
    console.error('💥 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      cause: error instanceof Error ? error.cause : undefined
    });
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.name : 'Unknown'
      },
      { status: 500 }
    );
  }
}

// GET method para testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || 'colosseum';

  // Redirect GET to POST for consistency
  return POST(new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ searchQuery: query })
  }));
}