-- CreateEnum
CREATE TYPE "CareerSummarySource" AS ENUM ('SELF_REQUESTED', 'ORGANIZATION_OFFBOARDING');

-- CreateEnum
CREATE TYPE "CareerSummaryStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "AssistantFocus" AS ENUM ('GENERAL', 'ROADMAP');

-- AlterTable
ALTER TABLE "AssistantConversation" ADD COLUMN     "focus" "AssistantFocus" NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "AssistantMessage" ADD COLUMN     "proposalData" JSONB;

-- AlterTable
ALTER TABLE "CareerSummary" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "dimensionScores" JSONB,
ADD COLUMN     "evaluation" TEXT,
ADD COLUMN     "generatedAt" TIMESTAMP(3),
ADD COLUMN     "requestedAt" TIMESTAMP(3),
ADD COLUMN     "requestedById" TEXT,
ADD COLUMN     "source" "CareerSummarySource" NOT NULL DEFAULT 'SELF_REQUESTED',
ADD COLUMN     "status" "CareerSummaryStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateIndex
CREATE INDEX "CareerSummary_employmentId_idx" ON "CareerSummary"("employmentId");

-- AddForeignKey
ALTER TABLE "CareerSummary" ADD CONSTRAINT "CareerSummary_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerSummary" ADD CONSTRAINT "CareerSummary_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
