// Comparison logic and finding next comparisons

import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc,
  runTransaction,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { Property, UserComparison, UserRanking, User } from '../types';
import { validateUserId, AuthError } from './auth';
import { buildWinGraph, canReach, simulateMatrixWithComparison, getUserPairwiseRelations } from './matrix';
import { getCurrentUserRanking } from './ranking';

interface InsertionInfo {
  needsComparison: boolean;
  compareWith?: string;
  insertIndex?: number;
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

// Insert a property without needing a comparison
async function insertPropertyWithoutComparison(
  userId: string,
  propertyId: string,
  position: number,
  ranking: UserRanking
) {
  const newOrderedIds = [...ranking.orderedPropertyIds];
  newOrderedIds.splice(position, 0, propertyId);
  
  // Get user's group
  const userDoc = await getDoc(doc(db, 'users', userId));
  const userData = userDoc.data() as User;
  if (!userData.groupId) {
    throw new Error('User is not in a group');
  }
  
  // Get total property count from user's group
  const propertiesSnapshot = await getDocs(collection(db, `groups/${userData.groupId}/properties`));
  const totalProperties = propertiesSnapshot.size;
  
  // Update the ranking
  const rankingRef = doc(db, `users/${userId}/rankings/${ranking.id!}`);
  await setDoc(rankingRef, {
    userId,
    orderedPropertyIds: newOrderedIds,
    lastUpdated: Date.now(),
    isComplete: newOrderedIds.length === totalProperties,
    totalProperties
  });
}

// Find the next comparison needed for binary insertion sort
export async function getNextComparisonPair(userId: string): Promise<Property[] | null> {
  try {
    validateUserId(userId);
    
    // Get user's group
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data() as User;
    if (!userData.groupId) {
      throw new Error('User is not in a group');
    }
    
    // Get all properties from user's group
    const propertiesSnapshot = await getDocs(collection(db, `groups/${userData.groupId}/properties`));
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

// Helper function to get comparison between two properties
export async function getComparisonBetween(
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
      
      // Get user's group
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data() as User;
      if (!userData.groupId) {
        throw new Error('User is not in a group');
      }
      
      // Get total property count from user's group
      const propertiesQuery = collection(db, `groups/${userData.groupId}/properties`);
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
