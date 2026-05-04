/**
 * 创建/重置一个超级管理员账号，并把它设为所有现有家族的 OWNER。
 *
 * 用法：
 *   pnpm tsx scripts/create-admin.ts <phone> <password> [name]
 *
 * 示例：
 *   pnpm tsx scripts/create-admin.ts 13800138000 admin123 丁某
 *
 * 行为：
 *   - 该手机号已存在 → 升级为 SUPERADMIN，更新密码与昵称
 *   - 不存在 → 新建 SUPERADMIN
 *   - 把它加入所有未删除家族为 OWNER（已存在则升级为 OWNER）
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [phoneArg, passwordArg, nameArg] = process.argv.slice(2);
  if (!phoneArg || !passwordArg) {
    console.error("用法: pnpm tsx scripts/create-admin.ts <phone> <password> [name]");
    process.exit(1);
  }
  const phone = phoneArg.trim().replace(/\s|-/g, "");
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    console.error("手机号格式不正确（需 11 位大陆手机号）");
    process.exit(1);
  }
  if (passwordArg.length < 6) {
    console.error("密码至少 6 位");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(passwordArg, 10);
  const name = (nameArg ?? "超级管理员").trim();

  const user = await prisma.user.upsert({
    where: { phone },
    update: { passwordHash, name, platformRole: "SUPERADMIN" },
    create: { phone, passwordHash, name, platformRole: "SUPERADMIN" },
    select: { id: true, phone: true, name: true, platformRole: true },
  });
  console.log("👤 用户 →", user);

  const families = await prisma.family.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  for (const f of families) {
    await prisma.familyMember.upsert({
      where: { userId_familyId: { userId: user.id, familyId: f.id } },
      update: { role: "OWNER" },
      create: { userId: user.id, familyId: f.id, role: "OWNER" },
    });
    console.log(`  ✅ ${f.name} (${f.id}) → OWNER`);
  }

  console.log("\n完成。可使用该手机号 + 密码登录。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
