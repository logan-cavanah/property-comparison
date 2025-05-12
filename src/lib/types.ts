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
  userId: string;
  winnerId: string;
  loserId: string;
  comparedAt: number;
}

export interface UserRanking {
  id: string;
  userId: string;
  orderedPropertyIds: string[]; // Array of property IDs in order from best to worst
  lastUpdated: number;
  isComplete: boolean; // Whether all necessary comparisons have been made
  totalProperties: number;
}
