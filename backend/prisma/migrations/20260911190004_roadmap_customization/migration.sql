-- AlterTable
ALTER TABLE "DevelopmentMilestone" ADD COLUMN     "category" "LifeCategory" NOT NULL DEFAULT 'WORK';

-- AlterTable
ALTER TABLE "DevelopmentPlan" ADD COLUMN     "displaySettings" JSONB,
ADD COLUMN     "durationWeeks" INTEGER,
ADD COLUMN     "hoursPerWeek" INTEGER;
