// src/lib/types.ts
export interface Property {
  id: string;
  url: string;
  addedBy: string;
  addedAt: number;
  site: string;
  propertyId: string;
  // New fields for detailed property information
  title?: string;
  description?: string;
  price?: number;
  priceFrequency?: string; // weekly, monthly, etc.
  bedrooms?: number;
  bathrooms?: number;
  postcode?: string;
  address?: string;
  propertyType?: string; // flat, house, etc.
  furnished?: string; // fully, partially, unfurnished
  availableFrom?: string;
  deposit?: number;
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  features?: string[]; // array of property features
  images?: string[]; // array of image URLs
  floorArea?: number;
  floorAreaUnit?: string; // sq ft, sq m
  lastScraped?: number; // timestamp
  latitude?: number;
  longitude?: number;
}


export interface UserComparison {
  id: string;
  // userId field is no longer needed since it's implied by the subcollection
  winnerId: string;
  loserId: string;
  comparedAt: number;
}


export interface UserRanking {
  id: string;
  // userId field is no longer needed since it's implied by the subcollection
  orderedPropertyIds: string[]; // Array of property IDs in order from best to worst
  lastUpdated: number;
  isComplete: boolean; // Whether all necessary comparisons have been made
  totalProperties: number;
}