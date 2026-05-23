// Listens to taskStore UI flags and renders the right enforcement modal
// (excuse, escalation decision, follow-up, call confirm) globally so any
// screen using markComplete/snoozeTask gets the behavior for free.

import { useMemo } from 'react';
import { useTaskStore } from '../store/taskStore';
import CallConfirmModal from './CallConfirmModal';
import EscalationDecisionModal from './EscalationDecisionModal';
import ExcuseModal from './ExcuseModal';
import FollowUpPrompt from './FollowUpPrompt';

export default function GlobalModalsHost() {
  const {
    tasks,
    pendingExcuseTaskId,
    pendingDecisionTaskId,
    pendingFollowUpTaskId,
    pendingCallConfirmTaskId,
    clearPending,
    markComplete,
    rescheduleBy,
    forceCancel,
  } = useTaskStore();

  const find = (id: string | null) => (id ? tasks.find((t) => t.id === id) ?? null : null);

  const excuseTask    = useMemo(() => find(pendingExcuseTaskId),     [pendingExcuseTaskId, tasks]);
  const decisionTask  = useMemo(() => find(pendingDecisionTaskId),   [pendingDecisionTaskId, tasks]);
  const followUpTask  = useMemo(() => find(pendingFollowUpTaskId),   [pendingFollowUpTaskId, tasks]);
  const callTask      = useMemo(() => find(pendingCallConfirmTaskId), [pendingCallConfirmTaskId, tasks]);

  return (
    <>
      <ExcuseModal
        visible={!!excuseTask}
        taskId={excuseTask?.id ?? null}
        taskTitle={excuseTask?.title}
        onClose={() => clearPending('excuse')}
      />

      <EscalationDecisionModal
        visible={!!decisionTask}
        task={decisionTask}
        onDoNow={() => decisionTask && markComplete(decisionTask.id)}
        onReschedule={(mins) => decisionTask && rescheduleBy(decisionTask.id, mins)}
        onCancel={() => decisionTask && forceCancel(decisionTask.id)}
        onClose={() => clearPending('decision')}
      />

      <FollowUpPrompt
        visible={!!followUpTask}
        task={followUpTask}
        onClose={() => clearPending('followUp')}
      />

      <CallConfirmModal
        visible={!!callTask}
        taskId={callTask?.id ?? null}
        taskTitle={callTask?.title}
        onConfirmed={() => callTask && markComplete(callTask.id)}
        onClose={() => clearPending('callConfirm')}
      />
    </>
  );
}
