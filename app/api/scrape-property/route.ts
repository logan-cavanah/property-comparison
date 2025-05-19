import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Helper function to extract JSON from script tags
const extractJsonFromHtml = (html: string, jsonVariableName: string = 'PAGE_MODEL') => {
  try {
    const $ = cheerio.load(html);
    
    // Look for script tags that might contain our JSON data
    let jsonData = null;
    
    $('script').each((_, script) => {
      const content = $(script).html() || '';
      
      // Look for the specific variable assignment pattern
      const pattern = new RegExp(`window\\.${jsonVariableName}\\s*=\\s*(\\{.*?\\});`, 's');
      const match = content.match(pattern);
      
      if (match && match[1]) {
        try {
          jsonData = JSON.parse(match[1]);
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
    const response = await axios.get(url);
    const pageModel = extractJsonFromHtml(response.data);
    
    if (!pageModel || !pageModel.propertyData) {
      throw new Error('Could not extract property data from Rightmove page');
    }
    
    const data = pageModel.propertyData;
    
    return {
      title: data.text?.propertyPhrase || '',
      description: data.text?.description?.replace(/<br\s*\/?>/g, '\n') || '',
      price: parseInt(data.prices?.primaryPrice?.replace(/[^0-9]/g, '')) || 0,
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
      images: data.images?.map(img => img.url) || [],
      floorArea: data.sizings?.find(s => s.unit === 'sqft')?.maximumSize || 0,
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
const detectSiteFromUrl = (url: string) => {
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
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        
        // Extract all potential JSON data from script tags
        const jsonData: Record<string, any> = {};
        
        $('script').each((index, script) => {
          const content = $(script).html() || '';
          
          // Look for common patterns of JSON data in script tags
          const patterns = [
            /window\.([A-Za-z0-9_]+)\s*=\s*(\{.*?\});/gs,
            /var\s+([A-Za-z0-9_]+)\s*=\s*(\{.*?\});/gs,
            /const\s+([A-Za-z0-9_]+)\s*=\s*(\{.*?\});/gs,
            /let\s+([A-Za-z0-9_]+)\s*=\s*(\{.*?\});/gs,
            /__NEXT_DATA__\s*=\s*(\{.*?\})/gs,
            /__PRELOADED_STATE__\s*=\s*(\{.*?\})/gs
          ];
          
          for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
              try {
                const varName = match[1] || `anonymousJson${index}`;
                const jsonStr = match[2] || match[1];
                const parsed = JSON.parse(jsonStr);
                jsonData[varName] = parsed;
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        });
        
        return NextResponse.json({
          url,
          detectedSite: detectSiteFromUrl(url),
          extractedData: jsonData
        });
      } catch (error) {
        console.error('Error in explore mode:', error);
        return NextResponse.json(
          { error: 'Failed to explore property data', details: error.message },
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
  } catch (error) {
    console.error('Error in scrape-property API route:', error);
    return NextResponse.json(
      { error: 'Failed to scrape property', details: error.message },
      { status: 500 }
    );
  }
}
