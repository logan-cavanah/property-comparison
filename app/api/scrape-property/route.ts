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
const extractJsonFromHtml = (html: string, jsonVariableName: string = 'PAGE_MODEL'): PageModel | null => {
  try {
    const $ = cheerio.load(html);
    let jsonData: PageModel | null = null;
    
    $('script').each((_, script) => {
      const content = $(script).html() || '';
      
      // Find the script containing our target variable
      if (content.includes(`window.${jsonVariableName}`)) {
        const pageModelStart = content.indexOf(`window.${jsonVariableName} =`);
        if (pageModelStart === -1) return;
        
        // Find the end of the JSON object by counting brackets
        let bracketCount = 0;
        let jsonEnd = pageModelStart;
        let foundStart = false;
        
        for (let i = pageModelStart; i < content.length; i++) {
          const char = content[i];
          if (char === '{') {
            bracketCount++;
            foundStart = true;
          } else if (char === '}') {
            bracketCount--;
            if (foundStart && bracketCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }
        
        if (jsonEnd === pageModelStart) return;
        
        const jsonStr = content.substring(
          pageModelStart + `window.${jsonVariableName} =`.length,
          jsonEnd
        ).trim();
        
        try {
          jsonData = JSON.parse(jsonStr) as PageModel;
          return false; // Break the loop once we find it
        } catch (e) {
          // Continue looking if this wasn't valid JSON
        }
      }
    });
    
    return jsonData;
  } catch (error) {
    console.error('Error extracting JSON from HTML:', error);
    return null;
  }
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
        const jsonData: Record<string, any> = {};

        // Split HTML into script tags
        const scriptTags = html.split('<script>');
        
        for (const script of scriptTags) {
          // Look for common patterns of JSON data in script tags
          const patterns = [
            /window\.([A-Za-z0-9_]+)\s*=\s*(\{.*?\});/,
            /var\s+([A-Za-z0-9_]+)\s*=\s*(\{.*?\});/,
            /const\s+([A-Za-z0-9_]+)\s*=\s*(\{.*?\});/,
            /let\s+([A-Za-z0-9_]+)\s*=\s*(\{.*?\});/,
            /__NEXT_DATA__\s*=\s*(\{.*?\})/,
            /__PRELOADED_STATE__\s*=\s*(\{.*?\})/
          ];

          for (const pattern of patterns) {
            const match = script.match(pattern);
            if (match) {
              try {
                const varName = match[1] || `anonymousJson${Object.keys(jsonData).length}`;
                const jsonStr = match[2] || match[1];
                
                // Use bracket counting to find complete JSON
                let bracketCount = 0;
                let jsonEnd = 0;
                let foundStart = false;
                
                for (let i = 0; i < jsonStr.length; i++) {
                  const char = jsonStr[i];
                  if (char === '{') {
                    bracketCount++;
                    foundStart = true;
                  } else if (char === '}') {
                    bracketCount--;
                    if (foundStart && bracketCount === 0) {
                      jsonEnd = i + 1;
                      break;
                    }
                  }
                }
                
                if (jsonEnd > 0) {
                  const completeJson = jsonStr.substring(0, jsonEnd);
                  const parsed = JSON.parse(completeJson);
                  jsonData[varName] = parsed;
                }
              } catch (e) {
                // Skip invalid JSON
                continue;
              }
            }
          }
        }

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
