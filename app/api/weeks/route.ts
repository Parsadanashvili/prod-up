import { NextRequest, NextResponse } from 'next/server';
import { getWeeksByUserId, getOrCreateWeek } from '@/lib/db/queries';

// GET /api/weeks - Get weeks for a user
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const weeks = await getWeeksByUserId(userId);
    return NextResponse.json({ weeks });
  } catch (error) {
    console.error('Error fetching weeks:', error);
    return NextResponse.json({ error: 'Failed to fetch weeks' }, { status: 500 });
  }
}

// POST /api/weeks - Get or create a week for a user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, date } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const targetDate = date ? new Date(date) : new Date();
    const week = await getOrCreateWeek(userId, targetDate);
    
    return NextResponse.json({ week });
  } catch (error) {
    console.error('Error creating week:', error);
    return NextResponse.json({ error: 'Failed to create week' }, { status: 500 });
  }
}

