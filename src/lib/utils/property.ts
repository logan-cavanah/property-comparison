// Property URL extraction and management utilities

import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  writeBatch,
  doc,
  getDoc
} from 'firebase/firestore';
import { Property, User } from '../types';

export interface PropertySiteInfo {
  site: string;
  propertyId: string;
}

export function extractPropertyInfo(url: string): PropertySiteInfo {
  try {
    const urlObj = new URL(url);
    
    if (urlObj.hostname.includes('rightmove.co.uk')) {
      const match = url.match(/\/properties\/(\d+)/);
      return { site: 'Rightmove', propertyId: match ? match[1] : 'unknown' };
    } else if (urlObj.hostname.includes('zoopla.co.uk')) {
      const match = url.match(/\/details\/(\d+)/);
      return { site: 'Zoopla', propertyId: match ? match[1] : 'unknown' };
    } else if (urlObj.hostname.includes('spareroom.co.uk')) {
      const searchParams = new URLSearchParams(urlObj.search);
      const flatshareId = searchParams.get('flatshare_id');
      return { site: 'SpareRoom', propertyId: flatshareId || 'unknown' };
    }
    
    return { site: 'Other', propertyId: 'unknown' };
  } catch (error) {
    return { site: 'Unknown', propertyId: 'unknown' };
  }
}

export function normalizePropertyUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let cleanPath = urlObj.pathname;
    
    if (urlObj.hostname.includes('rightmove.co.uk')) {
      const match = cleanPath.match(/\/properties\/(\d+)/);
      if (match) {
        return `https://www.rightmove.co.uk/properties/${match[1]}`;
      }
    } else if (urlObj.hostname.includes('zoopla.co.uk')) {
      const match = cleanPath.match(/\/details\/(\d+)/);
      if (match) {
        return `https://www.zoopla.co.uk/to-rent/details/${match[1]}`;
      }
    } else if (urlObj.hostname.includes('spareroom.co.uk')) {
      const searchParams = new URLSearchParams(urlObj.search);
      const flatshareId = searchParams.get('flatshare_id');
      if (flatshareId) {
        return `https://www.spareroom.co.uk/flatshare/flatshare_detail.pl?flatshare_id=${flatshareId}`;
      }
    }
    
    return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
  } catch (error) {
    console.error('URL normalization error:', error);
    return url;
  }
}

async function resetAllUserRankings() {
  const rankingsSnapshot = await getDocs(collection(db, 'userRankings'));
  const batch = writeBatch(db);
  
  rankingsSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
}

export async function addProperty(url: string, displayName: string): Promise<string> {
  try {
    const normalizedUrl = normalizePropertyUrl(url);
    const propertyInfo = extractPropertyInfo(normalizedUrl);
    
    // Check if property already exists
    const existingQuery = query(collection(db, 'properties'), 
      where('site', '==', propertyInfo.site),
      where('propertyId', '==', propertyInfo.propertyId)
    );
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      throw new Error('This property already exists in the database');
    }
    
    // Add the property
    const docRef = await addDoc(collection(db, 'properties'), {
      url: normalizedUrl,
      addedBy: displayName,
      addedAt: Date.now(),
      site: propertyInfo.site,
      propertyId: propertyInfo.propertyId
    });
    
    // Reset all user rankings since a new property was added
    await resetAllUserRankings();
    
    return docRef.id;
  } catch (error) {
    console.error("Error adding property:", error);
    throw error;
  }
}
