import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getAggregateFromServer, count } from 'firebase/firestore';

export async function GET() {
  try {
    const coll = collection(db, 'properties');
    const snapshot = await getAggregateFromServer(coll, {
      countOfDocs: count()
    });
    
    return NextResponse.json({ count: snapshot.data().countOfDocs });
  } catch (error) {
    console.error('Error getting property count:', error);
    return NextResponse.json({ count: 0 });
  }
}
