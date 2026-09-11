BEGIN;

-- CreateEnum
CREATE TYPE "AdminPermission" AS ENUM ('VIEW', 'COLLECT', 'CROSS_ASSESS', 'APPROVE', 'EDIT', 'FULL');

-- CreateEnum
CREATE TYPE "AssessmentScoreDimension" AS ENUM ('CONTRIBUTION', 'ATTITUDE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminPermissions" "AdminPermission"[] DEFAULT ARRAY[]::"AdminPermission"[];

-- AlterTable
ALTER TABLE "AssessmentGroup" ADD COLUMN     "scoreDimension" "AssessmentScoreDimension" NOT NULL DEFAULT 'CONTRIBUTION';

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "attitudeScore" DOUBLE PRECISION,
ADD COLUMN     "contributionScore" DOUBLE PRECISION;

-- Preserve existing company admins; new accounts default to no grants.
UPDATE "User" SET "adminPermissions" = ARRAY['FULL']::"AdminPermission"[]
WHERE "role" = 'COMPANY_ADMIN';

-- Old templates have no explicit dimension. Their frozen overall scores
-- become CONTRIBUTION only; do not invent an attitude score for history.
UPDATE "Assessment" SET "contributionScore" = "totalScore"
WHERE "status" = 'APPROVED' AND "totalScore" BETWEEN 0 AND 10;

UPDATE "User" AS u
SET "contributionScore" = scores.average_score
FROM (
  SELECT "revieweeId", ROUND(AVG("contributionScore")::numeric, 2)::double precision AS average_score
  FROM "Assessment"
  WHERE "status" = 'APPROVED' AND "contributionScore" IS NOT NULL
  GROUP BY "revieweeId"
) AS scores
WHERE u.id = scores."revieweeId";

COMMIT;
