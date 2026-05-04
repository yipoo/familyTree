/**
 * 一次性脚本：把指定手机号的用户设为 SUPERADMIN，并重置密码。
 * 使用：pnpm tsx scripts/set-super.ts <phone> <password> [name]
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { hashPassword, normalizePhone } from "../lib/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const phoneArg = process.argv[2];
  const password = process.argv[3];
  const nameArg = process.argv[4] ?? "总管理员";
  if (!phoneArg || !password) {
    console.error("用法：pnpm tsx scripts/set-super.ts <phone> <password> [name]");
    process.exit(1);
  }
  const phone = normalizePhone(phoneArg);
  if (!phone) {
    console.error("手机号格式不正确：", phoneArg);
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { phone },
    update: { passwordHash, platformRole: "SUPERADMIN", name: nameArg },
    create: { phone, passwordHash, name: nameArg, platformRole: "SUPERADMIN" },
    select: { id: true, phone: true, name: true, platformRole: true },
  });
  console.log("✅ 已设置：", user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
