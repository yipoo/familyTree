-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "contactPhoneHash" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "wechatOpenId" TEXT,
ADD COLUMN     "wechatUnionId" TEXT;

-- CreateIndex
CREATE INDEX "Person_contactPhoneHash_idx" ON "Person"("contactPhoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_wechatOpenId_key" ON "User"("wechatOpenId");
