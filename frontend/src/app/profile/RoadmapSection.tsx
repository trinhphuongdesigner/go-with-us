'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import type { DevelopmentRoadmap } from '@/lib/api/developmentPlansApi';
import RoadmapSummaryCard from './RoadmapSummaryCard';
import RoadmapStaircase from './RoadmapStaircase';
import RoadmapDetailPanel from './RoadmapDetailPanel';
import RoadmapDiagram from './RoadmapDiagram';
import type { RoadmapCharacter } from './roadmapCharacters';

interface Props {
  roadmap: DevelopmentRoadmap;
  defaultExpanded?: boolean;
  viewMode: 'stair' | 'diagram';
  character?: RoadmapCharacter | 'none';
  isDraft?: boolean;
  onSetViewMode: (mode: 'stair' | 'diagram') => void;
  onToggleTask: (taskId: string, done: boolean) => void;
}

export default function RoadmapSection({
  roadmap,
  defaultExpanded = false,
  viewMode,
  character,
  isDraft = false,
  onSetViewMode,
  onToggleTask,
}: Props) {
  const sectionRef = React.useRef<HTMLDivElement | null>(null);
  const sortedMilestones = React.useMemo(
    () => [...roadmap.milestones].sort((a, b) => a.order - b.order),
    [roadmap.milestones],
  );
  const currentIndex = React.useMemo(() => {
    if (sortedMilestones.length === 0) return -1;
    const index = sortedMilestones.findIndex((milestone) => milestone.status !== 'DONE');
    return index === -1 ? sortedMilestones.length - 1 : index;
  }, [sortedMilestones]);
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [selectedIndex, setSelectedIndex] = React.useState(currentIndex >= 0 ? currentIndex : 0);

  React.useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const expandAndScroll = React.useCallback(() => {
    setExpanded(true);
    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const toggleExpanded = React.useCallback(() => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    expandAndScroll();
  }, [expandAndScroll, expanded]);

  const selectedMilestone = sortedMilestones[selectedIndex];
  const goalTitle = sortedMilestones.at(-1)?.title ?? null;

  return (
    <Box ref={sectionRef}>
      <RoadmapSummaryCard
        goalTitle={goalTitle}
        milestones={sortedMilestones}
        currentIndex={currentIndex}
        durationWeeks={roadmap.durationWeeks}
        hoursPerWeek={roadmap.hoursPerWeek}
        character={character}
        isDraft={isDraft}
        expanded={expanded}
        onContinue={sortedMilestones.length > 0 ? expandAndScroll : undefined}
        onViewAll={sortedMilestones.length > 0 ? toggleExpanded : undefined}
      />

      {expanded && sortedMilestones.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' }, gap: 2, mt: 2 }}>
          {viewMode === 'stair' ? (
            <RoadmapStaircase
              milestones={sortedMilestones}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              currentIndex={currentIndex}
              character={character}
              startDate={roadmap.createdAt}
            />
          ) : (
            <RoadmapDiagram
              milestones={sortedMilestones}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              currentIndex={currentIndex}
            />
          )}
          <RoadmapDetailPanel
            milestone={selectedMilestone}
            index={selectedIndex}
            onToggleTask={onToggleTask}
            onViewDiagram={viewMode === 'stair' ? () => onSetViewMode('diagram') : undefined}
          />
        </Box>
      )}
    </Box>
  );
}
