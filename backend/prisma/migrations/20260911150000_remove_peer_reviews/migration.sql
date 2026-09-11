-- DropForeignKey
ALTER TABLE "PeerReview" DROP CONSTRAINT "PeerReview_reviewerId_fkey";

-- DropForeignKey
ALTER TABLE "PeerReview" DROP CONSTRAINT "PeerReview_revieweeId_fkey";

-- DropTable
DROP TABLE "PeerReview";
