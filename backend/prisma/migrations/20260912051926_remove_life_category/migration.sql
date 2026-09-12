/*
  Warnings:

  - You are about to drop the column `category` on the `Award` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `DevelopmentGoal` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `DevelopmentRoadmap` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "DevelopmentRoadmap_planId_category_idx";

-- AlterTable
ALTER TABLE "Award" DROP COLUMN "category";

-- AlterTable
ALTER TABLE "DevelopmentGoal" DROP COLUMN "category";

-- AlterTable
ALTER TABLE "DevelopmentRoadmap" DROP COLUMN "category";

-- DropEnum
DROP TYPE "LifeCategory";

-- CreateIndex
CREATE INDEX "DevelopmentRoadmap_planId_idx" ON "DevelopmentRoadmap"("planId");
