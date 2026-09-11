-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "onboardDate" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT;
