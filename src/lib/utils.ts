import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc,
  writeBatch,
  runTransaction,
  deleteDoc,
  setDoc,
  collectionGroup
} from 'firebase/firestore';
import { Property, UserComparison, UserRanking } from './types';

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

interface PropertySiteInfo {
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

function normalizePropertyUrl(url: string): string {
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

export async function addProperty(url: string, userId: string): Promise<string> {
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
      addedBy: userId,
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

async function resetAllUserRankings() {
  const rankingsSnapshot = await getDocs(collection(db, 'userRankings'));
  const batch = writeBatch(db);
  
  rankingsSnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
}

async function getCurrentUserRanking(userId: string): Promise<UserRanking | null> {
  const rankingQuery = query(
    collection(db, `users/${userId}/rankings`)
  );
  
  const rankingSnapshot = await getDocs(rankingQuery);
  
  if (rankingSnapshot.empty) {
    return null;
  }
  
  const doc = rankingSnapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data()
  } as UserRanking;
}

// Helper: Simulate adding a direct comparison and recompute the pairwise matrix
function simulateMatrixWithComparison(
  matrix: { [a: string]: { [b: string]: 'direct' | 'inferred' | 'unknown' } },
  propertyIds: string[],
  winner: string,
  loser: string
): { [a: string]: { [b: string]: 'direct' | 'inferred' | 'unknown' } } {
  // Clone the win graph from the matrix
  const winGraph = new Map<string, Set<string>>();
  for (const a of propertyIds) {
    for (const b of propertyIds) {
      if (matrix[a][b] === 'direct' || matrix[a][b] === 'inferred') {
        if (!winGraph.has(a)) winGraph.set(a, new Set());
        winGraph.get(a)!.add(b);
      }
    }
  }
  // Add the simulated direct comparison
  if (!winGraph.has(winner)) winGraph.set(winner, new Set());
  winGraph.get(winner)!.add(loser);

  // Helper to check reachability
  function canReach(start: string, target: string, visited = new Set<string>()): boolean {
    if (start === target) return true;
    if (visited.has(start)) return false;
    visited.add(start);
    const losers = winGraph.get(start) || new Set();
    for (const loser of losers) {
      if (canReach(loser, target, visited)) return true;
    }
    return false;
  }

  // Recompute the matrix
  const newMatrix: { [a: string]: { [b: string]: 'direct' | 'inferred' | 'unknown' } } = {};
  for (const a of propertyIds) {
    newMatrix[a] = {};
    for (const b of propertyIds) {
      if (a === b) {
        newMatrix[a][b] = 'direct';
      } else if ((matrix[a][b] === 'direct' && !(a === winner && b === loser)) || (a === winner && b === loser)) {
        newMatrix[a][b] = 'direct';
      } else if (canReach(a, b)) {
        newMatrix[a][b] = 'inferred';
      } else if (canReach(b, a)) {
        newMatrix[a][b] = 'inferred';
      } else {
        newMatrix[a][b] = 'unknown';
      }
    }
  }
  return newMatrix;
}

function validateUserId(userId: string) {
  if (!userId || typeof userId !== 'string') {
    throw new AuthError('Invalid user ID');
  }
}

// Find the next comparison needed for binary insertion sort
export async function getNextComparisonPair(userId: string): Promise<Property[] | null> {
  try {
    validateUserId(userId);
    
    // Get all properties
    const propertiesSnapshot = await getDocs(collection(db, 'properties'));
    const allProperties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Property));
    
    if (allProperties.length < 2) {
      return null;
    }
    
    // Get user's current ranking
    const ranking = await getCurrentUserRanking(userId);
    
    if (!ranking || ranking.orderedPropertyIds.length === 0) {
      // No ranking exists yet, start with first two properties
      return [allProperties[0], allProperties[1]];
    }
    
    // Find properties not yet in the ranking
    const rankedPropertyIds = new Set(ranking.orderedPropertyIds);
    const unrankedProperties = allProperties.filter(prop => !rankedPropertyIds.has(prop.id));
    
    if (unrankedProperties.length > 0) {
      // Take the first unranked property and find where to insert it
      const propertyToInsert = unrankedProperties[0];
      
      // Binary search to find where this property should be inserted
      const insertionInfo = await findInsertionPosition(
        userId,
        propertyToInsert.id,
        ranking.orderedPropertyIds,
        allProperties
      );
      
      if (insertionInfo.needsComparison) {
        const compareWithProperty = allProperties.find(p => p.id === insertionInfo.compareWith);
        return compareWithProperty ? [propertyToInsert, compareWithProperty] : null;
      }
      
      // If no comparison is needed, insert the property directly
      await insertPropertyWithoutComparison(userId, propertyToInsert.id, insertionInfo.insertIndex!, ranking);
      
      // Continue with the next property
      return getNextComparisonPair(userId);
    }
    
    // All properties are ranked. Now, do smarter selection for remaining unknowns.
    // Build the pairwise matrix
    const { matrix, propertyIds } = await getUserPairwiseRelations(userId);
    let bestPair: [string, string] | null = null;
    let bestGain = -1;
    
    for (let i = 0; i < propertyIds.length; ++i) {
      for (let j = i + 1; j < propertyIds.length; ++j) {
        const a = propertyIds[i];
        const b = propertyIds[j];
        if (matrix[a][b] === 'unknown') {
          // Simulate both outcomes
          const matrixA = simulateMatrixWithComparison(matrix, propertyIds, a, b);
          const matrixB = simulateMatrixWithComparison(matrix, propertyIds, b, a);
          // Count resolved unknowns
          let gainA = 0, gainB = 0;
          for (const x of propertyIds) {
            for (const y of propertyIds) {
              if (x !== y && matrix[x][y] === 'unknown') {
                if (matrixA[x][y] !== 'unknown') gainA++;
                if (matrixB[x][y] !== 'unknown') gainB++;
              }
            }
          }
          const gain = Math.max(gainA, gainB);
          if (gain > bestGain) {
            bestGain = gain;
            bestPair = [a, b];
          }
        }
      }
    }
    
    if (bestPair) {
      const [a, b] = bestPair;
      const propA = allProperties.find(p => p.id === a);
      const propB = allProperties.find(p => p.id === b);
      if (propA && propB) {
        return [propA, propB];
      }
    }
    
    // All relationships are resolved
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('Error getting next comparison pair:', error);
    throw new Error('Failed to get next comparison pair');
  }
}

interface InsertionInfo {
  needsComparison: boolean;
  compareWith?: string;
  insertIndex?: number;
}

// Helper to build a win graph from all user comparisons
async function buildWinGraph(userId: string): Promise<Map<string, Set<string>>> {
  const comparisonsQuery = collection(db, `users/${userId}/comparisons`);
  const snapshot = await getDocs(comparisonsQuery);
  const winGraph = new Map<string, Set<string>>();
  snapshot.docs.forEach(doc => {
    const data = doc.data() as UserComparison;
    if (!winGraph.has(data.winnerId)) winGraph.set(data.winnerId, new Set());
    winGraph.get(data.winnerId)!.add(data.loserId);
  });
  return winGraph;
}

// Helper to check if there's a path from start to target in the win graph
function canReach(winGraph: Map<string, Set<string>>, start: string, target: string, visited = new Set<string>()): boolean {
  if (start === target) return true;
  if (visited.has(start)) return false;
  visited.add(start);
  const losers = winGraph.get(start) || new Set();
  for (const loser of losers) {
    if (canReach(winGraph, loser, target, visited)) return true;
  }
  return false;
}

// Adaptive binary insertion with transitive closure
async function findInsertionPosition(
  userId: string,
  propertyId: string,
  orderedIds: string[],
  allProperties: Property[]
): Promise<InsertionInfo> {
  if (orderedIds.length === 0) {
    return { needsComparison: false, insertIndex: 0 };
  }

  const winGraph = await buildWinGraph(userId);
  let left = 0;
  let right = orderedIds.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const midPropertyId = orderedIds[mid];

    // Check if order can be inferred
    if (canReach(winGraph, propertyId, midPropertyId)) {
      // propertyId is ranked above midPropertyId
      right = mid;
    } else if (canReach(winGraph, midPropertyId, propertyId)) {
      // propertyId is ranked below midPropertyId
      left = mid + 1;
    } else {
      // Order is ambiguous, need direct comparison
      return { needsComparison: true, compareWith: midPropertyId };
    }
  }

  // If we reach here, all necessary orderings can be inferred
  return { needsComparison: false, insertIndex: left };
}

// Helper function to get comparison between two properties
async function getComparisonBetween(
  userId: string,
  property1Id: string,
  property2Id: string
): Promise<UserComparison | null> {
  const comparisonQuery = collection(db, `users/${userId}/comparisons`);
  
  const snapshot = await getDocs(comparisonQuery);
  
  for (const doc of snapshot.docs) {
    const data = doc.data() as UserComparison;
    if ((data.winnerId === property1Id && data.loserId === property2Id) ||
        (data.winnerId === property2Id && data.loserId === property1Id)) {
      return data;
    }
  }
  
  return null;
}

// Insert a property without needing a comparison
async function insertPropertyWithoutComparison(
  userId: string,
  propertyId: string,
  position: number,
  ranking: UserRanking
) {
  const newOrderedIds = [...ranking.orderedPropertyIds];
  newOrderedIds.splice(position, 0, propertyId);
  
  // Get total property count
  const propertiesSnapshot = await getDocs(collection(db, 'properties'));
  const totalProperties = propertiesSnapshot.size;
  
  // Update the ranking
  const rankingRef = doc(db, 'userRankings', ranking.id!);
  await setDoc(rankingRef, {
    userId,
    orderedPropertyIds: newOrderedIds,
    lastUpdated: Date.now(),
    isComplete: newOrderedIds.length === totalProperties,
    totalProperties
  });
}

// Record a comparison and update rankings using binary insertion sort
// Record a comparison and update rankings using binary insertion sort
export async function recordComparisonAndUpdateRankings(
  userId: string, 
  winnerId: string, 
  loserId: string
) {
  try {
    validateUserId(userId);
    
    await runTransaction(db, async (transaction) => {
      // Add the comparison to the user's subcollection
      const comparisonRef = doc(collection(db, `users/${userId}/comparisons`));
      transaction.set(comparisonRef, {
        id: comparisonRef.id,
        winnerId,
        loserId,
        comparedAt: Date.now()
      });
      
      // Get current ranking
      const rankingQuery = collection(db, `users/${userId}/rankings`);
      const rankingSnapshot = await getDocs(rankingQuery);
      
      let currentRanking: UserRanking | null = null;
      let rankingRef;
      
      if (!rankingSnapshot.empty) {
        const doc = rankingSnapshot.docs[0];
        currentRanking = { id: doc.id, ...doc.data() } as UserRanking;
        rankingRef = doc.ref;
      } else {
        rankingRef = doc(collection(db, `users/${userId}/rankings`));
        currentRanking = {
          id: rankingRef.id,
          orderedPropertyIds: [],
          lastUpdated: Date.now(),
          isComplete: false,
          totalProperties: 0
        } satisfies UserRanking;
      }
      
      // Update the ranking based on the new comparison
      const orderedIds = currentRanking?.orderedPropertyIds || [];
      let newOrderedIds = [...orderedIds];
      
      const winnerInList = newOrderedIds.includes(winnerId);
      const loserInList = newOrderedIds.includes(loserId);
      
      if (!winnerInList && !loserInList) {
        // Both are new - winner goes before loser
        newOrderedIds = [winnerId, loserId];
      } else if (!winnerInList) {
        // Winner is new - find correct position for winner
        const loserIndex = newOrderedIds.findIndex(id => id === loserId);
        // Winner must go somewhere before loser's position
        newOrderedIds.splice(loserIndex, 0, winnerId);
      } else if (!loserInList) {
        // Loser is new - find correct position for loser
        const winnerIndex = newOrderedIds.findIndex(id => id === winnerId);
        // Loser must go somewhere after winner's position
        newOrderedIds.splice(winnerIndex + 1, 0, loserId);
      } else {
        // Both are in the list - ensure consistency
        const winnerIndex = newOrderedIds.findIndex(id => id === winnerId);
        const loserIndex = newOrderedIds.findIndex(id => id === loserId);
        
        if (winnerIndex > loserIndex) {
          // Winner is after loser, which is inconsistent
          // Remove winner and reinsert it before loser
          newOrderedIds.splice(winnerIndex, 1);
          const newLoserIndex = newOrderedIds.findIndex(id => id === loserId);
          newOrderedIds.splice(newLoserIndex, 0, winnerId);
        }
      }
      
      // Get total property count
      const propertiesQuery = collection(db, 'properties');
      const propertiesSnapshot = await getDocs(propertiesQuery);
      const totalProperties = propertiesSnapshot.size;
      const isComplete = newOrderedIds.length === totalProperties;
      
      // Update ranking
      transaction.set(rankingRef, {
        orderedPropertyIds: newOrderedIds,
        lastUpdated: Date.now(),
        isComplete,
        totalProperties
      });
    });
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('Error recording comparison:', error);
    throw new Error('Failed to record comparison');
  }
}

// Get global rankings
export async function getGlobalRankings(): Promise<{ property: Property; rank: number; score: number }[]> {
  // Get all properties
  const propertiesSnapshot = await getDocs(collection(db, 'properties'));
  const properties = new Map(
    propertiesSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Property])
  );
  
  // Get all user rankings
  const userRankingsSnapshot = await getDocs(collection(db, 'userRankings'));
  const propertyScores = new Map<string, number[]>();
  
  userRankingsSnapshot.forEach(doc => {
    const ranking = doc.data() as UserRanking;
    if (ranking.isComplete) {
      ranking.orderedPropertyIds.forEach((propertyId, index) => {
        if (!propertyScores.has(propertyId)) {
          propertyScores.set(propertyId, []);
        }
        propertyScores.get(propertyId)!.push(index + 1);
      });
    }
  });
  
  // Calculate average rank for each property
  const propertyAverages: { propertyId: string; avgRank: number; rankCount: number }[] = [];
  
  propertyScores.forEach((ranks, propertyId) => {
    const avgRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
    propertyAverages.push({
      propertyId,
      avgRank,
      rankCount: ranks.length
    });
  });
  
  // Sort by average rank (lower is better)
  propertyAverages.sort((a, b) => {
    if (a.rankCount === 0 && b.rankCount === 0) return 0;
    if (a.rankCount === 0) return 1;
    if (b.rankCount === 0) return -1;
    return a.avgRank - b.avgRank;
  });
  
  // Add properties that haven't been ranked yet
  properties.forEach((property, id) => {
    if (!propertyScores.has(id)) {
      propertyAverages.push({
        propertyId: id,
        avgRank: Number.MAX_VALUE,
        rankCount: 0
      });
    }
  });
  
  // Convert to final ranking format
  return propertyAverages.map((item, index) => ({
    property: properties.get(item.propertyId)!,
    rank: index + 1,
    score: item.avgRank === Number.MAX_VALUE ? 0 : item.avgRank
  }));
}

export async function resetUserComparisonsAndRankings(userId: string) {
  try {
    validateUserId(userId);
    
    // Delete all user comparisons
    const comparisonsQuery = collection(db, `users/${userId}/comparisons`);
    const comparisonsSnapshot = await getDocs(comparisonsQuery);
    const batch = writeBatch(db);
    
    comparisonsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete user ranking
    const rankingQuery = collection(db, `users/${userId}/rankings`);
    const rankingSnapshot = await getDocs(rankingQuery);
    
    rankingSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('Error resetting comparisons and rankings:', error);
    throw new Error('Failed to reset comparisons and rankings');
  }
}

// Debug: Return a matrix of all property pairs and their relation: 'direct', 'inferred', or 'unknown'
export async function getUserPairwiseRelations(userId: string): Promise<{
  matrix: { [a: string]: { [b: string]: 'direct' | 'inferred' | 'unknown' } };
  propertyIds: string[];
  idToPropertyId: { [docId: string]: string };
}> {
  try {
    validateUserId(userId);
    
    // Get all properties
    const propertiesSnapshot = await getDocs(collection(db, 'properties'));
    const propertyIds = propertiesSnapshot.docs.map(doc => doc.id);
    const idToPropertyId: { [docId: string]: string } = {};
    propertiesSnapshot.docs.forEach(doc => {
      idToPropertyId[doc.id] = doc.data().propertyId || doc.id;
    });

    // Build win graph and direct comparison set
    const comparisonsQuery = collection(db, `users/${userId}/comparisons`);
    const snapshot = await getDocs(comparisonsQuery);
    const winGraph = new Map<string, Set<string>>();
    const directSet = new Set<string>();
    snapshot.docs.forEach(doc => {
      const data = doc.data() as UserComparison;
      if (!winGraph.has(data.winnerId)) winGraph.set(data.winnerId, new Set());
      winGraph.get(data.winnerId)!.add(data.loserId);
      directSet.add(`${data.winnerId}|${data.loserId}`);
      directSet.add(`${data.loserId}|${data.winnerId}`);
    });

    // Helper to check reachability
    function canReach(start: string, target: string, visited = new Set<string>()): boolean {
      if (start === target) return true;
      if (visited.has(start)) return false;
      visited.add(start);
      const losers = winGraph.get(start) || new Set();
      for (const loser of losers) {
        if (canReach(loser, target, visited)) return true;
      }
      return false;
    }

    // Build matrix
    const matrix: { [a: string]: { [b: string]: 'direct' | 'inferred' | 'unknown' } } = {};
    for (const a of propertyIds) {
      matrix[a] = {};
      for (const b of propertyIds) {
        if (a === b) {
          matrix[a][b] = 'direct';
        } else if (directSet.has(`${a}|${b}`)) {
          matrix[a][b] = 'direct';
        } else if (canReach(a, b)) {
          matrix[a][b] = 'inferred';
        } else if (canReach(b, a)) {
          matrix[a][b] = 'inferred';
        } else {
          matrix[a][b] = 'unknown';
        }
      }
    }
    return { matrix, propertyIds, idToPropertyId };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('Error getting pairwise relations:', error);
    throw new Error('Failed to get pairwise relations');
  }
}