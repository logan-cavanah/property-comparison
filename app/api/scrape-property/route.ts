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
        const jsonData: Record<string, any> = {};
        const jsonContents: Array<{
          index: number;
          preview: string;
          length: number;
          type: string;
          path: string;
        }> = [];

        // Function to try parsing JSON from a string
        const tryParseJSON = (str: string): any | null => {
          try {
            return JSON.parse(str);
          } catch (e) {
            return null;
          }
        };

        // Function to check if JSON is meaningful
        const isMeaningfulJSON = (json: any): boolean => {
          // Check if it's an object
          if (typeof json === 'object' && json !== null) {
            // For objects, check if they have meaningful properties
            if (Array.isArray(json)) {
              // For arrays, check if they have meaningful items
              return json.length > 0 && json.some(item => 
                typeof item === 'object' && item !== null && Object.keys(item).length > 0
              );
            } else {
              // For objects, check if they have meaningful properties
              const keys = Object.keys(json);
              return keys.length > 0 && keys.some(key => {
                const value = json[key];
                return typeof value === 'object' && value !== null && Object.keys(value).length > 0;
              });
            }
          }
          return false;
        };

        // Function to extract JSON from a string
        const extractJSON = (str: string, path: string): void => {
          // Look for JSON objects
          const jsonObjectRegex = /({[\s\S]*?})/g;
          let match;
          let index = jsonContents.length;

          while ((match = jsonObjectRegex.exec(str)) !== null) {
            const jsonStr = match[1];
            // Skip if the JSON string is too short (less than 10 characters)
            if (jsonStr.length < 10) continue;
            
            const parsed = tryParseJSON(jsonStr);
            if (parsed && typeof parsed === 'object' && isMeaningfulJSON(parsed)) {
              jsonContents.push({
                index: index++,
                preview: jsonStr.substring(0, 200) + (jsonStr.length > 200 ? '...' : ''),
                length: jsonStr.length,
                type: 'Object',
                path
              });
            }
          }

          // Look for JSON arrays
          const jsonArrayRegex = /(\[[\s\S]*?\])/g;
          while ((match = jsonArrayRegex.exec(str)) !== null) {
            const jsonStr = match[1];
            // Skip if the JSON string is too short (less than 10 characters)
            if (jsonStr.length < 10) continue;
            
            const parsed = tryParseJSON(jsonStr);
            if (parsed && Array.isArray(parsed) && isMeaningfulJSON(parsed)) {
              jsonContents.push({
                index: index++,
                preview: jsonStr.substring(0, 200) + (jsonStr.length > 200 ? '...' : ''),
                length: jsonStr.length,
                type: 'Array',
                path
              });
            }
          }
        };

        // Look for JSON in script tags
        const $ = cheerio.load(html);
        $('script').each((i, script) => {
          const content = $(script).html() || '';
          const type = $(script).attr('type') || '';
          const id = $(script).attr('id') || '';
          const path = `script${id ? `#${id}` : ''}${type ? `[type="${type}"]` : ''}`;
          
          // Check for application/json type
          if (type === 'application/json') {
            const parsed = tryParseJSON(content);
            if (parsed && isMeaningfulJSON(parsed)) {
              jsonContents.push({
                index: jsonContents.length,
                preview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
                length: content.length,
                type: 'application/json',
                path
              });
            }
          }

          // Look for variable assignments that might contain JSON
          const varAssignments = content.match(/var\s+([A-Za-z0-9_]+)\s*=\s*([^;]+);/g) || [];
          const constAssignments = content.match(/const\s+([A-Za-z0-9_]+)\s*=\s*([^;]+);/g) || [];
          const letAssignments = content.match(/let\s+([A-Za-z0-9_]+)\s*=\s*([^;]+);/g) || [];
          const windowAssignments = content.match(/window\.([A-Za-z0-9_]+)\s*=\s*([^;]+);/g) || [];

          // Process each type of assignment
          const processAssignments = (assignments: string[], prefix: string) => {
            assignments.forEach(assignment => {
              const match = assignment.match(new RegExp(`${prefix}\\s+([A-Za-z0-9_]+)\\s*=\s*([^;]+);`));
              if (match) {
                const [_, varName, value] = match;
                try {
                  // Try to parse as JSON if it looks like an object or array
                  if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
                    const jsonValue = JSON.parse(value);
                    if (isMeaningfulJSON(jsonValue)) {
                      jsonData[`${prefix}_${varName}`] = jsonValue;
                      extractJSON(value, `${path} > ${prefix} ${varName}`);
                    }
                  } else {
                    // Store as string if not JSON
                    jsonData[`${prefix}_${varName}`] = value;
                  }
                } catch (e) {
                  // Store as string if parsing fails
                  jsonData[`${prefix}_${varName}`] = value;
                }
              }
            });
          };

          processAssignments(varAssignments, 'var');
          processAssignments(constAssignments, 'const');
          processAssignments(letAssignments, 'let');
          processAssignments(windowAssignments, 'window');

          // Also look for JSON in the script content itself
          extractJSON(content, path);
        });

        // Look for JSON in data attributes
        $('[data-json]').each((i, el) => {
          const jsonStr = $(el).attr('data-json');
          if (jsonStr && jsonStr.length >= 10) {
            const parsed = tryParseJSON(jsonStr);
            if (parsed && isMeaningfulJSON(parsed)) {
              jsonContents.push({
                index: jsonContents.length,
                preview: jsonStr.substring(0, 200) + (jsonStr.length > 200 ? '...' : ''),
                length: jsonStr.length,
                type: 'data-json attribute',
                path: `[data-json]`
              });
            }
          }
        });

        return NextResponse.json({
          url,
          detectedSite: detectSiteFromUrl(url),
          jsonContents,
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
