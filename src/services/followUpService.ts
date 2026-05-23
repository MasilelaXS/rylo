// Follow-up service — creates a "chase" task when a comm task is completed.

import { insertFollowUp } from '../database/followUps';
import { insertTask } from '../database/tasks';
import type { FollowUp, Task } from '../types';
import { generateId } from '../utils/constants';

export async function createFollowUp(source: Task, expectedReplyAt: number): Promise<{ chase: Task; followUp: FollowUp }> {
  const chase: Task = {
    id: generateId(),
    title: `Chase: ${source.title}`,
    description: `Follow up on "${source.title}" — expected reply by ${new Date(expectedReplyAt).toLocaleString()}.`,
    dueDate: expectedReplyAt,
    priority: source.priority === 'low' ? 'medium' : source.priority,
    status: 'pending',
    escalationLevel: 0,
    projectId: source.projectId,
    repeatType: 'none',
    voiceReminderEnabled: source.voiceReminderEnabled,
    communicationTarget: source.communicationTarget,
    snoozeCount: 0,
    createdAt: Date.now(),
    location: source.location ?? '',
    estimatedMinutes: source.estimatedMinutes ?? 5,
    category: 'communication',
    commStatus: 'pending',
  };
  await insertTask(chase);

  const followUp: FollowUp = {
    id: generateId(),
    sourceTaskId: source.id,
    chaseTaskId: chase.id,
    expectedReplyAt,
    createdAt: Date.now(),
  };
  await insertFollowUp(followUp);
  return { chase, followUp };
}
