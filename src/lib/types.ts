export interface Property {
  id: string;
  url: string;
  addedBy: string;
  addedAt: number;
  site: string;
  propertyId: string;
  // Property can only be added to a group, no longer standalone
  groupId: string; // ID of the group this property belongs to
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

export interface User {
  id: string;
  email: string;
  displayName?: string;
  workplaceAddress?: string;
  groupId?: string;
  updatedAt?: number;
  photoURL: string | null;
  createdAt: number;
  lastLogin: number;
}

// New types for group functionality
export interface Group {
  id: string;
  name: string;
  createdBy: string; // user ID of creator
  createdAt: number;
  members: string[]; // array of user IDs
  invitationCode: string;
}

export interface Invitation {
  id: string;
  groupId: string;
  groupName: string;
  invitedBy: string; // user ID of inviter
  invitedByName: string; // display name of inviter
  invitationCode: string;
  createdAt: number;
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