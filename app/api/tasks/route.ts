import { NextRequest, NextResponse } from 'next/server';
import { getTasksByUserId, getTasksByWeekId, createTask, updateTask, deleteTask, getTaskById } from '@/lib/db/queries';
import { getOrCreateWeek } from '@/lib/db/queries';
import type { TaskStatus } from '@/lib/db/schema';

// GET /api/tasks - Get tasks for user or by week
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const weekId = searchParams.get('weekId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    let tasks;
    if (weekId) {
      tasks = await getTasksByWeekId(weekId);
    } else {
      tasks = await getTasksByUserId(userId);
    }

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, title, description, status, weekId } = body;

    if (!userId || !title) {
      return NextResponse.json({ error: 'userId and title are required' }, { status: 400 });
    }

    // Get or create week if not provided
    let finalWeekId = weekId;
    if (!finalWeekId) {
      const week = await getOrCreateWeek(userId);
      finalWeekId = week.id;
    }

    const task = await createTask({
      userId,
      weekId: finalWeekId,
      title,
      description: description || null,
      status: (status as TaskStatus) || 'not_started',
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

// PATCH /api/tasks - Update a task
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task id is required' }, { status: 400 });
    }

    const task = await updateTask(id, updates);
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/tasks - Delete a task
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Task id is required' }, { status: 400 });
    }

    await deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

