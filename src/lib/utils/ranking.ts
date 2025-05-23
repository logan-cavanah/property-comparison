// Ranking utilities and calculation

import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  query,
  writeBatch,
  getDoc,
  doc,
} from 'firebase/firestore';
import { Property, UserRanking } from '../types';
import { validateUserId, AuthError } from './auth';

export async function getCurrentUserRanking(userId: string): Promise<UserRanking | null> {
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

// Get group rankings using sum of ranks method
export async function getGroupRankings(groupId: string): Promise<{ property: Property; rank: number; score: number; rankCount: number; totalUsers: number }[]> {
  // Get all properties from the specified group
  const propertiesSnapshot = await getDocs(collection(db, `groups/${groupId}/properties`));
  const properties = new Map(
    propertiesSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Property])
  );
  
  // Get all users in this group
  const groupDoc = await getDoc(doc(db, 'groups', groupId));
  if (!groupDoc.exists()) {
    throw new Error('Group not found');
  }
  const groupData = groupDoc.data();
  const memberIds = groupData.members || [];
  
  // Get rankings from all group members
  const propertyScores = new Map<string, number[]>();
  const totalUsers = memberIds.length;
  
  // For each group member, get their rankings
  for (const userId of memberIds) {
    const rankingsSnapshot = await getDocs(collection(db, `users/${userId}/rankings`));
    
    rankingsSnapshot.forEach(doc => {
      const ranking = doc.data() as UserRanking;
      if (ranking.isComplete) {
        // Only include property IDs that exist in this group
        ranking.orderedPropertyIds
          .filter(propertyId => properties.has(propertyId))
          .forEach((propertyId, index) => {
            if (!propertyScores.has(propertyId)) {
              propertyScores.set(propertyId, []);
            }
            propertyScores.get(propertyId)!.push(index + 1);
          });
      }
    });
  }
  
  // Calculate sum of ranks for each property
  const propertySums: { propertyId: string; totalScore: number; rankCount: number }[] = [];
  
  propertyScores.forEach((ranks, propertyId) => {
    const totalScore = ranks.reduce((sum, rank) => sum + rank, 0);
    propertySums.push({
      propertyId,
      totalScore,
      rankCount: ranks.length
    });
  });
  
  // Add properties that haven't been ranked yet
  properties.forEach((property, id) => {
    if (!propertyScores.has(id)) {
      propertySums.push({
        propertyId: id,
        totalScore: Number.MAX_VALUE,
        rankCount: 0
      });
    }
  });
  
  // Sort by total score (lower is better)
  propertySums.sort((a, b) => {
    if (a.rankCount === 0 && b.rankCount === 0) return 0;
    if (a.rankCount === 0) return 1;
    if (b.rankCount === 0) return -1;
    return a.totalScore - b.totalScore;
  });
  
  // Convert to final ranking format
  return propertySums.map((item, index) => ({
    property: properties.get(item.propertyId)!,
    rank: index + 1,
    score: item.totalScore === Number.MAX_VALUE ? Number.MAX_VALUE : item.totalScore,
    rankCount: item.rankCount,
    totalUsers: totalUsers
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
