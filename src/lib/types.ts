// src/lib/types.ts
export interface Property {
  id: string;
  url: string;
  addedBy: string;
  addedAt: number;
  site: string;
  propertyId: string;
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