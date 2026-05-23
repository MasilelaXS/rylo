// Calling service — opens the system dialer and tracks confirmation state.
// The confirmation modal flips task.commStatus from 'attempted' → 'confirmed' or back.

import * as Linking from 'expo-linking';
import { updateTask } from '../database/tasks';

export async function startCall(taskId: string, phone: string): Promise<void> {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (!cleaned) return;
  await updateTask({ id: taskId, commStatus: 'attempted' });
  await Linking.openURL(`tel:${cleaned}`);
}

export async function confirmCall(taskId: string, confirmed: boolean): Promise<void> {
  await updateTask({ id: taskId, commStatus: confirmed ? 'confirmed' : 'pending' });
}
