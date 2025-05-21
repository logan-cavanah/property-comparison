import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getAggregateFromServer, count, doc, getDoc } from 'firebase/firestore';
import { User } from '@/lib/types';

export async function GET(request: Request) {
  try {
    // Get user ID from query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get user's group
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data() as User;
    if (!userData.groupId) {
      return NextResponse.json({ count: 0 });
    }

    // Count properties in user's group
    const coll = collection(db, `groups/${userData.groupId}/properties`);
    const snapshot = await getAggregateFromServer(coll, {
      countOfDocs: count()
    });
    
    return NextResponse.json({ count: snapshot.data().countOfDocs });
  } catch (error) {
    console.error('Error getting property count:', error);
    return NextResponse.json({ count: 0 });
  }
}
