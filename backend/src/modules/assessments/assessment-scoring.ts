import { BadRequestException } from '@nestjs/common';
import { AssessmentScoreDimension } from '@prisma/client';

type ScoringTemplate = {
  groups: {
    weight: number;
    scoreDimension: AssessmentScoreDimension;
    questions: { id: string; weight: number; maxScore: number }[];
  }[];
};
type ScoringAnswer = { questionId: string; score: number };

export function validateAnswers(
  template: ScoringTemplate,
  answers: ScoringAnswer[],
  requireComplete = false,
): void {
  const questions = new Map(
    template.groups.flatMap((g) => g.questions).map((q) => [q.id, q]),
  );
  const seen = new Set<string>();
  for (const answer of answers) {
    const question = questions.get(answer.questionId);
    if (!question || seen.has(answer.questionId)) {
      throw new BadRequestException(
        'Answers must reference unique questions from this template',
      );
    }
    if (
      !Number.isInteger(answer.score) ||
      answer.score < 1 ||
      answer.score > question.maxScore
    ) {
      throw new BadRequestException(
        `Score must be between 1 and ${question.maxScore}`,
      );
    }
    seen.add(answer.questionId);
  }
  if (
    requireComplete &&
    template.groups.some(
      (g) =>
        g.weight > 0 &&
        g.questions.some((q) => q.weight > 0 && !seen.has(q.id)),
    )
  ) {
    throw new BadRequestException(
      'Answer every scored question before submitting or approving',
    );
  }
}

/** Normalize each question to 0-10, average questions, then average groups. */
export function computeAssessmentScores(
  template: ScoringTemplate,
  answers: ScoringAnswer[],
) {
  validateAnswers(template, answers, true);
  const scoreByQuestion = new Map(answers.map((a) => [a.questionId, a.score]));
  const groups = template.groups.map((group) => {
    const weight = group.questions.reduce((sum, q) => sum + q.weight, 0);
    const sum = group.questions.reduce(
      (sum, q) =>
        sum + ((scoreByQuestion.get(q.id) ?? 0) / q.maxScore) * 10 * q.weight,
      0,
    );
    return {
      dimension: group.scoreDimension,
      weight: group.weight,
      score: weight > 0 ? sum / weight : null,
    };
  });
  const average = (dimension?: AssessmentScoreDimension): number | null => {
    const selected = groups.filter(
      (g) =>
        g.score !== null &&
        g.weight > 0 &&
        (!dimension || g.dimension === dimension),
    );
    const weight = selected.reduce((sum, g) => sum + g.weight, 0);
    return weight > 0
      ? roundScore(
          selected.reduce((sum, g) => sum + g.score! * g.weight, 0) / weight,
        )
      : null;
  };
  const totalScore = average();
  if (totalScore === null || !Number.isFinite(totalScore)) {
    throw new BadRequestException(
      'The template needs positively weighted questions and groups',
    );
  }
  return {
    totalScore,
    contributionScore: average(AssessmentScoreDimension.CONTRIBUTION),
    attitudeScore: average(AssessmentScoreDimension.ATTITUDE),
  };
}

export const roundScore = (score: number): number =>
  Math.round((score + Number.EPSILON) * 100) / 100;
