import bcrypt from "bcryptjs";
import { prisma } from "../src/database/prisma.js";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function monthsAgo(months: number, dayOfMonth = 10): Date {
  const d = new Date();
  d.setDate(1); // avoid month-rollover surprises (e.g. Jan 31 - 1 month)
  d.setMonth(d.getMonth() - months);
  d.setDate(dayOfMonth);
  d.setHours(9, 0, 0, 0);
  return d;
}

async function main() {
  console.log("Seeding...");

  // --- Master data ---------------------------------------------------------
  const roleNames = ["admin", "committee", "municipality", "buyer", "member"];
  const roles = new Map<string, number>();
  for (const roleName of roleNames) {
    const role = await prisma.role.upsert({
      where: { roleName },
      update: {},
      create: { roleName },
    });
    roles.set(roleName, role.id);
  }

  // Households are linked to their village further down, right after the
  // village_area master data is created - the FK is what committee permissions
  // resolve against, so a seeded member with no village would be invisible to
  // every committee.
  const householdA = await prisma.household.create({
    data: {
      houseNo: "12",
      moo: "1",
      subdistrict: "สามง่ามพัฒนา",
      district: "หันคา",
      province: "ชัยนาท",
      postcode: "17130",
    },
  });
  const householdB = await prisma.household.create({
    data: {
      houseNo: "45",
      moo: "2",
      subdistrict: "สามง่ามพัฒนา",
      district: "หันคา",
      province: "ชัยนาท",
      postcode: "17130",
    },
  });

  const wasteTypeSeed = [
    { wasteName: "ขวดพลาสติก PET", unit: "kg", defaultPrice: 8 },
    { wasteName: "กระดาษลัง", unit: "kg", defaultPrice: 3.5 },
    { wasteName: "แก้วใส/แก้วสี", unit: "kg", defaultPrice: 3 },
    { wasteName: "เศษเหล็ก", unit: "kg", defaultPrice: 8.5 },
    { wasteName: "อะลูมิเนียม", unit: "kg", defaultPrice: 35 },
    { wasteName: "กระดาษขาวดำ", unit: "kg", defaultPrice: 4.5 },
  ];
  const wasteTypes = [];
  for (const wt of wasteTypeSeed) {
    const wasteType = await prisma.wasteType.create({ data: wt });
    wasteTypes.push(wasteType);
    await prisma.wastePriceHistory.create({
      data: {
        wasteTypeId: wasteType.id,
        price: wasteType.defaultPrice,
        effectiveFrom: new Date(2026, 6, 1),
      },
    });
  }
  const [pet, cardboard, glass, , aluminum] = wasteTypes;

  const buyer = await prisma.buyer.create({
    data: {
      buyerName: "ร้านรับซื้อของเก่าสามง่าม",
      contactName: "คุณประเสริฐ",
      phone: "056-123-456",
      address: "ต.สามง่ามพัฒนา อ.หันคา จ.ชัยนาท",
    },
  });

  await prisma.villageArea.createMany({
    data: [
      {
        villageName: "บ้านหนองน้ำ",
        moo: "1",
        subdistrict: "สามง่ามท่าโบสถ์",
        district: "หันคา",
        province: "ชัยนาท",
        postcode: "17130",
      },
      {
        villageName: "บ้านโคกสูง",
        moo: "2",
        subdistrict: "สามง่ามท่าโบสถ์",
        district: "หันคา",
        province: "ชัยนาท",
        postcode: "17130",
      },
      {
        villageName: "บ้านสามง่ามพัฒนา",
        moo: "3",
        subdistrict: "สามง่ามท่าโบสถ์",
        district: "หันคา",
        province: "ชัยนาท",
        postcode: "17130",
      },
    ],
  });
  // One municipality -> many villages -> one committee each. Every committee
  // account below is bound to the village it is responsible for.
  const villageMoo1 = await prisma.villageArea.findFirstOrThrow({
    where: { moo: "1" },
  });
  const villageMoo2 = await prisma.villageArea.findFirstOrThrow({
    where: { moo: "2" },
  });

  // Bind the households created above to their village (see comment there).
  await prisma.household.update({
    where: { id: householdA.id },
    data: { villageAreaId: villageMoo1.id },
  });
  await prisma.household.update({
    where: { id: householdB.id },
    data: { villageAreaId: villageMoo2.id },
  });

  await prisma.userAccount.create({
    data: {
      username: "buyer01",
      passwordHash: await bcrypt.hash("Buyer123!", 10),
      mustChangePassword: true,
      fullName: "ร้านรับซื้อของเก่าสามง่าม",
      phone: "056-123-456",
      roleId: roles.get("buyer")!,
      // Binds the login to the shop it works for - what scopes the buyer to its
      // own pickup route plans (see middleware/buyerScope.ts).
      buyerId: buyer.id,
    },
  });

  const fundAccount = await prisma.fundAccount.create({
    data: {
      accountName: "กองทุนฌาปนกิจสงเคราะห์ชุมชนสามง่ามพัฒนา",
      balance: 0,
    },
  });

  // Placeholder committee account so created_by/recorded_by/issued_by columns
  // (plain int columns - see schema.prisma header comment) have a realistic value.
  const committeeUser = await prisma.userAccount.create({
    data: {
      username: "committee01",
      passwordHash: await bcrypt.hash("Committee123!", 10),
      mustChangePassword: true,
      fullName: `กรรมการ${villageMoo1.villageName} (หมู่ ${villageMoo1.moo})`,
      roleId: roles.get("committee")!,
      villageAreaId: villageMoo1.id,
    },
  });

  // Second village's committee - handy for checking that neither committee can
  // see the other village's members.
  await prisma.userAccount.create({
    data: {
      username: "committee02",
      passwordHash: await bcrypt.hash("Committee123!", 10),
      mustChangePassword: true,
      fullName: `กรรมการ${villageMoo2.villageName} (หมู่ ${villageMoo2.moo})`,
      roleId: roles.get("committee")!,
      villageAreaId: villageMoo2.id,
    },
  });

  // Real admin login (authService.login() now allows non-member roles - see
  // backend/src/services/authService.ts). Memberless, same pattern as committeeUser above.
  const adminUser = await prisma.userAccount.create({
    data: {
      username: "admin",
      passwordHash: await bcrypt.hash("Admin123!", 10),
      mustChangePassword: true,
      fullName: "ผู้ดูแลระบบ",
      roleId: roles.get("admin")!,
    },
  });

  await prisma.systemSetting.createMany({
    data: [
      {
        settingKey: "fund.minimumContributionBaht",
        settingValue: "50",
        valueType: "number",
        description: "ยอดเงินกองทุนขั้นต่ำของสมาชิก",
        updatedBy: adminUser.id,
      },
      {
        settingKey: "member.minAge",
        settingValue: "18",
        valueType: "number",
        description: "อายุขั้นต่ำของผู้สมัครสมาชิก",
        updatedBy: adminUser.id,
      },
      {
        settingKey: "member.maxAge",
        settingValue: "70",
        valueType: "number",
        description: "อายุสูงสุดของผู้สมัครสมาชิก",
        updatedBy: adminUser.id,
      },
    ],
  });

  // Public-site visibility windows (backend/src/services/publicVisibilityService.ts).
  // Upserted with update: {} so re-seeding never overwrites a value the admin changed.
  for (const setting of [
    { settingKey: "news.visibleDays", description: "จำนวนวันล่าสุดที่แสดงข่าวสารบนหน้าเว็บ (0 = ไม่จำกัด)" },
    { settingKey: "video.visibleDays", description: "จำนวนวันล่าสุดที่แสดงวิดีโอบนหน้าเว็บ (0 = ไม่จำกัด)" },
  ]) {
    await prisma.systemSetting.upsert({
      where: { settingKey: setting.settingKey },
      update: {},
      create: { ...setting, settingValue: "365", valueType: "number", updatedBy: adminUser.id },
    });
  }

  // Municipality officer login (read-only monitoring/reporting - see
  // backend/src/routes/municipalityRoutes.ts). Memberless, same pattern as admin.
  await prisma.userAccount.upsert({
    where: { username: "municipality01" },
    update: {},
    create: {
      username: "municipality01",
      passwordHash: await bcrypt.hash("Municipality123!", 10),
      mustChangePassword: true,
      fullName: "เจ้าหน้าที่เทศบาล (ตัวอย่าง)",
      roleId: roles.get("municipality")!,
    },
  });

  // --- Collection rounds -----------------------------------------------------
  // Two open upcoming rounds a member can pick for a new sell request, plus one
  // cancelled upcoming round to demonstrate the "closed round" case, plus four
  // past completed rounds backing the sample sales history below.
  const upcomingPlannedA = await prisma.collectionRound.create({
    data: {
      roundDate: addDays(new Date(), 7),
      startTime: "09:00",
      endTime: "12:00",
      buyerId: buyer.id,
      locationNote: "หมู่ 1 บ้านหนองน้ำ",
      status: "planned",
      createdBy: committeeUser.id,
    },
  });
  await prisma.collectionRound.create({
    data: {
      roundDate: addDays(new Date(), 14),
      startTime: "10:00",
      endTime: "13:00",
      buyerId: buyer.id,
      locationNote: "หมู่ 2 บ้านโคกสูง",
      status: "planned",
      createdBy: committeeUser.id,
    },
  });
  await prisma.collectionRound.create({
    data: {
      roundDate: addDays(new Date(), 10),
      startTime: "09:00",
      endTime: "12:00",
      buyerId: buyer.id,
      locationNote: "หมู่ 1 บ้านหนองน้ำ",
      status: "cancelled",
      createdBy: committeeUser.id,
    },
  });

  const pastRounds = [];
  for (let i = 3; i >= 0; i--) {
    pastRounds.push(
      await prisma.collectionRound.create({
        data: {
          roundDate: monthsAgo(i),
          startTime: "09:00",
          endTime: "12:00",
          buyerId: buyer.id,
          locationNote: "หมู่ 1 บ้านหนองน้ำ",
          status: "completed",
          createdBy: committeeUser.id,
        },
      }),
    );
  }

  // --- Sample active member ---------------------------------------------------
  const member = await prisma.member.create({
    data: {
      memberCode: "001",
      householdId: householdA.id,
      citizenId: "1100000000001",
      prefix: "นาย",
      firstName: "สมชาย",
      lastName: "วงศ์ใหญ่",
      birthDate: new Date("1985-05-10"),
      gender: "male",
      phone: "081-234-5678",
      occupation: "เกษตรกร",
      approvedDate: monthsAgo(6),
      status: "active",
      userAccount: {
        create: {
          username: "1100000000001",
          passwordHash: await bcrypt.hash("Member123!", 10),
          mustChangePassword: true,
          fullName: "นายสมชาย วงศ์ใหญ่",
          phone: "081-234-5678",
          roleId: roles.get("member")!,
        },
      },
      guarantors: {
        create: {
          guarantorName: "นางสมหญิง วงศ์ใหญ่",
          guarantorPhone: "081-999-8888",
          relationship: "คู่สมรส",
        },
      },
    },
    include: { userAccount: true },
  });

  // --- Selling history + fund contributions -----------------------------------
  // 4 consecutive months of completed sales -> continuousMonthCount = 4 (out of the
  // 6 required), and fund contributions that bring the balance up to exactly the
  // 50-baht minimum, then stop - a clean, realistic state to exercise /eligibility
  // and /fund against.
  const salePlan = [
    { round: pastRounds[0]!, wasteType: pet, quantity: 5, monthsBack: 3 },
    {
      round: pastRounds[1]!,
      wasteType: cardboard,
      quantity: 10,
      monthsBack: 2,
    },
    { round: pastRounds[2]!, wasteType: glass, quantity: 8, monthsBack: 1 },
    { round: pastRounds[3]!, wasteType: aluminum, quantity: 2, monthsBack: 0 },
  ];

  let fundBalance = 0;
  const FUND_MINIMUM = 50;

  for (const [index, plan] of salePlan.entries()) {
    const subtotal = plan.quantity * plan.wasteType.defaultPrice;
    const saleDate = monthsAgo(plan.monthsBack);
    const fundDeduct = Math.min(
      subtotal,
      Math.max(FUND_MINIMUM - fundBalance, 0),
    );
    const netAmount = subtotal - fundDeduct;

    const sale = await prisma.wasteSale.create({
      data: {
        saleNo: `SL-${saleDate.getFullYear()}${String(saleDate.getMonth() + 1).padStart(2, "0")}-${index + 1}`,
        memberId: member.id,
        roundId: plan.round.id,
        buyerId: buyer.id,
        saleDate,
        totalAmount: subtotal,
        fundDeductAmount: fundDeduct,
        netAmount,
        recordedBy: committeeUser.id,
        status: "completed",
        details: {
          create: [
            {
              wasteTypeId: plan.wasteType.id,
              quantity: plan.quantity,
              unitPrice: plan.wasteType.defaultPrice,
              subtotal,
            },
          ],
        },
      },
    });

    await prisma.receipt.create({
      data: {
        receiptNo: `RC-${saleDate.getFullYear()}${String(saleDate.getMonth() + 1).padStart(2, "0")}${String(saleDate.getDate()).padStart(2, "0")}-${index + 1}`,
        saleId: sale.id,
        receiptDate: saleDate,
        totalAmount: subtotal,
        fundAmount: fundDeduct,
        paidAmount: netAmount,
        issuedBy: committeeUser.id,
      },
    });

    if (fundDeduct > 0) {
      fundBalance += fundDeduct;
      await prisma.fundTransaction.create({
        data: {
          fundAccountId: fundAccount.id,
          memberId: member.id,
          saleId: sale.id,
          transactionDate: saleDate,
          transactionType: "contribution",
          amountIn: fundDeduct,
          balanceAfter: fundBalance,
          recordedBy: committeeUser.id,
          note: "หักสมทบอัตโนมัติจากยอดขายขยะ",
        },
      });
    }
  }

  await prisma.memberFundBalance.create({
    data: {
      memberId: member.id,
      totalContribution: fundBalance,
      lastContributionDate: monthsAgo(2),
    },
  });
  await prisma.fundAccount.update({
    where: { id: fundAccount.id },
    data: { balance: fundBalance },
  });

  // A still-open sell request against the nearest upcoming round, to exercise
  // GET /sell-requests, the committee's /committee/sell-requests review +
  // purchase-recording flow, and PATCH /sell-requests/:id/cancel out of the box.
  // Coordinates are in ต.สามง่ามท่าโบสถ์ อ.หันคา จ.ชัยนาท (approx).
  await prisma.saleRequest.create({
    data: {
      memberId: member.id,
      roundId: upcomingPlannedA.id,
      pickupAddress: "บ้านเลขที่ 12 หมู่ 1 ต.สามง่ามพัฒนา อ.หันคา จ.ชัยนาท",
      pickupLat: 15.0412,
      pickupLng: 100.0631,
      estimatedQuantity: 12,
      note: "ขยะรวมไว้หน้าบ้าน โทรก่อนถึง 10 นาที",
      status: "requested",
      items: {
        create: [
          { wasteTypeId: pet.id, estimatedQuantity: 8 },
          { wasteTypeId: cardboard.id, estimatedQuantity: 4 },
        ],
      },
    },
  });

  await prisma.notification.create({
    data: {
      userId: committeeUser.id,
      title: "มีคำร้องขายขยะใหม่",
      message: "นายสมชาย วงศ์ใหญ่ แจ้งขายขยะประมาณ 12 กก. รอการรับเรื่อง",
      notificationType: "sell_request",
    },
  });

  await prisma.notification.create({
    data: {
      userId: member.userAccount!.id,
      title: "ประกาศรอบรับซื้อขยะใหม่",
      message:
        "ธนาคารขยะเปิดรอบรับซื้อใหม่แล้ว สามารถแจ้งความประสงค์ขายขยะได้ในระบบ",
      notificationType: "schedule",
    },
  });

  // --- Pending walk-in applicant ----------------------------------------------
  // A second member still in 'pending' so the committee's "Add Member" flow
  // (verify eligibility -> record result -> approve) can be exercised right
  // after seeding. Initial password = citizen ID, same default the committee
  // create endpoint uses.
  await prisma.member.create({
    data: {
      memberCode: "002",
      citizenId: "1100000000002",
      prefix: "นาง",
      firstName: "สุดา",
      lastName: "ใจดี",
      birthDate: new Date("1990-11-22"),
      gender: "female",
      phone: "082-345-6789",
      occupation: "ค้าขาย",
      status: "pending",
      householdId: householdB.id,
      guarantors: {
        create: {
          guarantorName: "นายสมชาย วงศ์ใหญ่",
          guarantorPhone: "081-234-5678",
          relationship: "เพื่อนบ้าน",
        },
      },
      userAccount: {
        create: {
          username: "1100000000002",
          passwordHash: await bcrypt.hash("1100000000002", 10),
          mustChangePassword: true,
          fullName: "นางสุดา ใจดี",
          phone: "082-345-6789",
          roleId: roles.get("member")!,
        },
      },
      fundBalance: { create: { totalContribution: 0 } },
    },
  });

  // --- News (not in ERD - see schema.prisma header) --------------------------
  const newsSeed = [
    {
      title: "โครงการธนาคารขยะ",
      details:
        "เชิญชวนสมาชิกเตรียมขยะรีไซเคิลที่คัดแยกแล้ว เพื่อเข้าร่วมรอบรับซื้อประจำเดือนและสมทบกองทุนชุมชน",
      postedAt: new Date(2026, 2, 15),
      sourceImage: "ข่าว 1.png",
      destName: "seed-news-1.png",
    },
    {
      title: "ร่วมเป็นส่วนหนึ่ง",
      details:
        "สมาชิกสามารถแจ้งความประสงค์ขายขยะล่วงหน้า เพื่อช่วยให้กรรมการวางแผนเส้นทางรับซื้อได้สะดวกและรวดเร็วขึ้น",
      postedAt: new Date(2026, 2, 10),
      sourceImage: "ข่าว 2.jpg",
      destName: "seed-news-2.jpg",
    },
    {
      title: "ทุกการรีไซเคิลมีความหมาย",
      details:
        "รายได้จากการขายขยะส่วนหนึ่งจะถูกนำไปสมทบกองทุนฌาปนกิจสงเคราะห์ เพื่อสร้างสวัสดิการให้สมาชิกในชุมชน",
      postedAt: new Date(2026, 2, 1),
      sourceImage: "ข่าว 3.jpg",
      destName: "seed-news-3.jpg",
    },
    {
      title: "คัดแยกขยะก่อนขาย",
      details:
        "ขอความร่วมมือสมาชิกแยกประเภทขยะให้ชัดเจนก่อนวันรับซื้อ เพื่อให้การชั่งน้ำหนัก ประเมินราคา และออกใบเสร็จเป็นไปอย่างรวดเร็ว",
      postedAt: new Date(2026, 1, 25),
      sourceImage: "ข่าว 4.jpg",
      destName: "seed-news-4.jpg",
    },
    {
      title: "ประชาสัมพันธ์กิจกรรมธนาคารขยะ",
      details:
        "อัปเดตภาพประชาสัมพันธ์จากแบนเนอร์หน้าแรก เพื่อให้สมาชิกติดตามกิจกรรมและข่าวสารของกองทุนธนาคารขยะได้จากหน้าข่าวสาร",
      postedAt: new Date(2026, 6, 12),
      sourceImage: "anou3.png",
      destName: "seed-news-banner-anou3.png",
    },
    {
      title: "ข่าวสารกองทุนธนาคารขยะเพื่อชุมชน",
      details:
        "ภาพประชาสัมพันธ์จากแบนเนอร์ถูกบันทึกเป็นข่าว เพื่อใช้แสดงรายละเอียดและเก็บเป็นประวัติข่าวสารของระบบ",
      postedAt: new Date(2026, 6, 11),
      sourceImage: "anou4.png",
      destName: "seed-news-banner-anou4.png",
    },
  ];

  for (const [index, item] of newsSeed.entries()) {
    const existing = await prisma.news.findFirst({ where: { title: item.title, postedAt: item.postedAt } });
    if (existing) continue;
    await prisma.news.create({
      data: {
        title: item.title,
        details: item.details,
        postedAt: item.postedAt,
        imageUrl: `https://placehold.co/1200x630/087f49/ffffff?text=WasteBank+${index + 1}`,
      },
    });
  }

  console.log("Seed complete.");
  console.log('Demo accounts seeded. Credentials are documented in README.md and must be changed before real use.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
