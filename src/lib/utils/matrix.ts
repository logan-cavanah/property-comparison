// Pairwise relationship matrix utilities

import { db } from '../firebase';
import { 
  collection, 
  getDocs,
  getDoc,
  doc,
} from 'firebase/firestore';
import { UserComparison, User } from '../types';
import { validateUserId } from './auth';

// Helper to build a win graph from all user comparisons
export async function buildWinGraph(userId: string): Promise<Map<string, Set<string>>> {
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
export function canReach(winGraph: Map<string, Set<string>>, start: string, target: string, visited = new Set<string>()): boolean {
  if (start === target) return true;
  if (visited.has(start)) return false;
  visited.add(start);
  const losers = winGraph.get(start) || new Set();
  for (const loser of losers) {
    if (canReach(winGraph, loser, target, visited)) return true;
  }
  return false;
}

// Simulate adding a direct comparison and recompute the pairwise matrix
export function simulateMatrixWithComparison(
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

// Get pairwise relations matrix for debugging
export async function getUserPairwiseRelations(userId: string): Promise<{
  matrix: { [a: string]: { [b: string]: 'direct' | 'inferred' | 'unknown' } };
  propertyIds: string[];
  idToPropertyId: { [docId: string]: string };
}> {
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
    function canReachLocal(start: string, target: string, visited = new Set<string>()): boolean {
      if (start === target) return true;
      if (visited.has(start)) return false;
      visited.add(start);
      const losers = winGraph.get(start) || new Set();
      for (const loser of losers) {
        if (canReachLocal(loser, target, visited)) return true;
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
        } else if (canReachLocal(a, b)) {
          matrix[a][b] = 'inferred';
        } else if (canReachLocal(b, a)) {
          matrix[a][b] = 'inferred';
        } else {
          matrix[a][b] = 'unknown';
        }
      }
    }
    return { matrix, propertyIds, idToPropertyId };
  } catch (error) {
    console.error('Error getting pairwise relations:', error);
    throw new Error('Failed to get pairwise relations');
  }
}
