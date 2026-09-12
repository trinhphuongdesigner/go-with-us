/*
  Warnings:

  - You are about to drop the column `category` on the `DevelopmentMilestone` table. All the data in the column will be lost.
  - You are about to drop the column `planId` on the `DevelopmentMilestone` table. All the data in the column will be lost.
  - You are about to drop the column `durationWeeks` on the `DevelopmentPlan` table. All the data in the column will be lost.
  - You are about to drop the column `hoursPerWeek` on the `DevelopmentPlan` table. All the data in the column will be lost.
  - Added the required column `roadmapId` to the `DevelopmentMilestone` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CompetencyRequestSourceType" AS ENUM ('CERTIFICATION', 'AWARD');

-- CreateEnum
CREATE TYPE "CompetencyRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "DevelopmentMilestone" DROP CONSTRAINT "DevelopmentMilestone_planId_fkey";

-- DropIndex
DROP INDEX "DevelopmentMilestone_planId_idx";

-- AlterTable
ALTER TABLE "DevelopmentMilestone" DROP COLUMN "category",
DROP COLUMN "planId",
ADD COLUMN     "roadmapId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DevelopmentPlan" DROP COLUMN "durationWeeks",
DROP COLUMN "hoursPerWeek";

-- AlterTable
ALTER TABLE "RoleDefinition" ALTER COLUMN "permissions" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CompetencyRequest" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceType" "CompetencyRequestSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "message" TEXT,
    "status" "CompetencyRequestStatus" NOT NULL DEFAULT 'PENDING',
    "pointsAwarded" INTEGER,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetencyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevelopmentRoadmap" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "category" "LifeCategory" NOT NULL DEFAULT 'WORK',
    "durationWeeks" INTEGER,
    "hoursPerWeek" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentRoadmap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetencyRequest_recipientId_status_idx" ON "CompetencyRequest"("recipientId", "status");

-- CreateIndex
CREATE INDEX "CompetencyRequest_senderId_idx" ON "CompetencyRequest"("senderId");

-- CreateIndex
CREATE INDEX "DevelopmentRoadmap_planId_category_idx" ON "DevelopmentRoadmap"("planId", "category");

-- CreateIndex
CREATE INDEX "DevelopmentMilestone_roadmapId_idx" ON "DevelopmentMilestone"("roadmapId");

-- AddForeignKey
ALTER TABLE "CompetencyRequest" ADD CONSTRAINT "CompetencyRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyRequest" ADD CONSTRAINT "CompetencyRequest_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyRequest" ADD CONSTRAINT "CompetencyRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentRoadmap" ADD CONSTRAINT "DevelopmentRoadmap_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DevelopmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentMilestone" ADD CONSTRAINT "DevelopmentMilestone_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "DevelopmentRoadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
