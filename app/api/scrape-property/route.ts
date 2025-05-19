import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Define interfaces for our data structures
interface PropertyData {
  text?: {
    propertyPhrase?: string;
    description?: string;
  };
  prices?: {
    primaryPrice?: string;
  };
  bedrooms?: number;
  bathrooms?: number;
  address?: {
    outcode?: string;
    incode?: string;
    displayAddress?: string;
  };
  propertySubType?: string;
  lettings?: {
    furnishType?: string;
    letAvailableDate?: string;
    deposit?: number;
  };
  customer?: {
    companyName?: string;
  };
  contactInfo?: {
    telephoneNumbers?: {
      localNumber?: string;
    };
  };
  keyFeatures?: string[];
  images?: Array<{ url: string }>;
  sizings?: Array<{
    unit: string;
    maximumSize?: number;
  }>;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  id?: string;
}

interface PageModel {
  propertyData: PropertyData;
}

// Helper function to extract JSON from script tags
const extractJsonFromHtml = (html: string): Record<string, any> => {
  const jsonData: Record<string, any> = {};
  const $ = cheerio.load(html);
  
  // 1. Look for JSON-LD data
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const content = $(script).html();
      if (content) {
        const json = JSON.parse(content);
        jsonData['jsonLd'] = json;
      }
    } catch (e) {
      // Skip invalid JSON
    }
  });

  // 2. Look for application/json scripts
  $('script[type="application/json"]').each((_, script) => {
    try {
      const content = $(script).html();
      if (content) {
        const json = JSON.parse(content);
        jsonData['applicationJson'] = json;
      }
    } catch (e) {
      // Skip invalid JSON
    }
  });

  // 3. Look for common variable assignments that might contain JSON
  $('script').each((_, script) => {
    const content = $(script).html() || '';
    
    // Common patterns for JSON data in scripts
    const patterns = [
      // window.__INITIAL_STATE__ = {...}
      /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/,
      // window.PAGE_MODEL = {...}
      /window\.PAGE_MODEL\s*=\s*({[\s\S]*?});/,
      // var data = {...}
      /var\s+data\s*=\s*({[\s\S]*?});/,
      // const data = {...}
      /const\s+data\s*=\s*({[\s\S]*?});/,
      // let data = {...}
      /let\s+data\s*=\s*({[\s\S]*?});/,
      // window.data = {...}
      /window\.data\s*=\s*({[\s\S]*?});/,
      // dataLayer.push({...})
      /dataLayer\.push\(({[\s\S]*?})\);/,
      // __PRELOADED_STATE__ = {...}
      /__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/,
      // window.__PRELOADED_STATE__ = {...}
      /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/,
      // window.__INITIAL_DATA__ = {...}
      /window\.__INITIAL_DATA__\s*=\s*({[\s\S]*?});/,
      // window.__APOLLO_STATE__ = {...}
      /window\.__APOLLO_STATE__\s*=\s*({[\s\S]*?});/
    ];

    patterns.forEach((pattern, index) => {
      const match = content.match(pattern);
      if (match) {
        try {
          const jsonStr = match[1];
          // Clean up the JSON string by removing any trailing commas
          const cleanJsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
          const json = JSON.parse(cleanJsonStr);
          jsonData[`pattern_${index}`] = json;
        } catch (e) {
          // Skip invalid JSON
        }
      }
    });

    // Look for any object-like structures that might be JSON
    const objectMatches = content.match(/({[^{}]*({[^{}]*})*[^{}]*})/g) || [];
    objectMatches.forEach((match, index) => {
      try {
        const json = JSON.parse(match);
        // Only include if it looks like meaningful data (has more than 2 properties)
        if (Object.keys(json).length > 2) {
          jsonData[`object_${index}`] = json;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
  });

  return jsonData;
};

// Function to scrape Rightmove property
const scrapeRightmove = async (url: string) => {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    const pageModel = extractJsonFromHtml(response.data);
    
    if (!pageModel || !pageModel.propertyData) {
      throw new Error('Could not extract property data from Rightmove page');
    }
    
    const data = pageModel.propertyData;
    
    return {
      title: data.text?.propertyPhrase || '',
      description: data.text?.description?.replace(/<br\s*\/?>/g, '\n') || '',
      price: parseInt(data.prices?.primaryPrice?.replace(/[^0-9]/g, '') ?? '0') || 0,
      priceFrequency: data.prices?.primaryPrice?.includes('pcm') ? 'pcm' : 
                      data.prices?.primaryPrice?.includes('pw') ? 'pw' : '',
      bedrooms: data.bedrooms || 0,
      bathrooms: data.bathrooms || 0,
      postcode: data.address?.outcode && data.address?.incode ? 
                `${data.address.outcode} ${data.address.incode}` : '',
      address: data.address?.displayAddress || '',
      propertyType: data.propertySubType || '',
      furnished: data.lettings?.furnishType || '',
      availableFrom: data.lettings?.letAvailableDate || '',
      deposit: data.lettings?.deposit || 0,
      agentName: data.customer?.companyName || '',
      agentPhone: data.contactInfo?.telephoneNumbers?.localNumber || '',
      features: data.keyFeatures || [],
      images: data.images?.map((img: { url: string }) => img.url) || [],
      floorArea: data.sizings?.find((s: { unit: string }) => s.unit === 'sqft')?.maximumSize || 0,
      floorAreaUnit: 'sq ft',
      latitude: data.location?.latitude || 0,
      longitude: data.location?.longitude || 0,
      propertyId: data.id || '',
      lastScraped: Date.now()
    };
  } catch (error) {
    console.error('Error scraping Rightmove property:', error);
    throw error;
  }
};

// Function to detect site from URL
const detectSiteFromUrl = (url: string): string => {
  if (url.includes('rightmove.co.uk')) return 'Rightmove';
  if (url.includes('zoopla.co.uk')) return 'Zoopla';
  return 'Unknown';
};

export async function POST(request: Request) {
  try {
    const { url, site, mode } = await request.json();
    
    // If in explore mode, just fetch and return all JSON data
    if (mode === 'explore') {
      try {
        console.log('Starting explore mode for URL:', url);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch page: ${response.statusText}`);
        }

        const html = await response.text();
        const jsonData = extractJsonFromHtml(html);

        return NextResponse.json({
          url,
          detectedSite: detectSiteFromUrl(url),
          extractedData: jsonData
        });
      } catch (error: unknown) {
        console.error('Error in explore mode:', error);
        return NextResponse.json(
          { error: 'Failed to explore property data', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        );
      }
    }
    
    // Normal scraping mode
    const detectedSite = site || detectSiteFromUrl(url);
    
    if (detectedSite === 'Rightmove') {
      const data = await scrapeRightmove(url);
      return NextResponse.json(data);
    } else if (detectedSite === 'Zoopla') {
      // Placeholder for Zoopla scraping - will be implemented after exploration
      return NextResponse.json({
        error: 'Zoopla scraping not yet implemented. Please use explore mode to analyze the page structure.'
      }, { status: 501 });
    } else {
      // Mock data for testing or unsupported sites
      return NextResponse.json({
        title: `Sample ${detectedSite} Property`,
        description: "This is a mock description that would normally be scraped from the property listing.",
        price: 1200,
        priceFrequency: 'pcm',
        bedrooms: 2,
        bathrooms: 1,
        postcode: 'Generic Postcode',
        propertyType: 'Unknown',
        features: ['Feature 1', 'Feature 2'],
        lastScraped: Date.now()
      });
    }
  } catch (error: unknown) {
    console.error('Error in scrape-property API route:', error);
    return NextResponse.json(
      { error: 'Failed to scrape property', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
