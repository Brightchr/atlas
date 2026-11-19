import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, ConfirmSheet, PageHeader, SectionLabel } from '@/components/ui';
import { useExerciseCatalog } from '@/features/exercises/api';
import { useArchiveGoal, useGoalProgress } from '../api';
import { AddGoalSheet } from '../components/AddGoalSheet';
import { GoalList } from '../components/GoalList';
import { PlanCard } from '../components/PlanCard';
import { WeightLogCard } from '../components/WeightLogCard';

export function GoalsPage() {
  const catalog = useExerciseCatalog();
  const progress = useGoalProgress(catalog.data);
  const archiveGoal = useArchiveGoal();

  const [adding, setAdding] = useState(false);
  // The goal waiting on an "Archive?" answer (null = no sheet open).
  const [archiving, setArchiving] = useState<{ id: string; title: string } | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <PageHeader
        title="Goals"
        actions={
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus size={18} aria-hidden />
            Add goal
          </Button>
        }
      />

      {/* Phones stack in source order, so the things used most come first:
          log weight, then goals, then the set-once targets calculator. From
          `lg` up, tracking sits on the left and setup on the right. */}
      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <WeightLogCard />
          <section className="space-y-2">
            <SectionLabel>Your goals</SectionLabel>
            <GoalList
              goals={progress.data}
              onArchive={setArchiving}
              onAdd={() => setAdding(true)}
            />
          </section>
        </div>

        <section className="min-w-0 space-y-2 lg:col-span-3">
          <SectionLabel>Daily targets</SectionLabel>
          <PlanCard />
        </section>
      </div>

      {adding && <AddGoalSheet onClose={() => setAdding(false)} />}

      {archiving && (
        <ConfirmSheet
          title="Archive this goal?"
          body={`"${archiving.title}" will stop being tracked and disappear from Home and this list.`}
          confirmLabel="Archive goal"
          pending={archiveGoal.isPending}
          onConfirm={() => {
            archiveGoal.mutate(archiving.id);
            setArchiving(null);
          }}
          onClose={() => setArchiving(null)}
        />
      )}
    </div>
  );
}
