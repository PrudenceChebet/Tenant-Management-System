// Demo data so the app has something to show on first run.
// Run with: npx prisma db seed
// Every demo account uses the password: Password123
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/db.js";

const hours = (h) => new Date(Date.now() - h * 3600 * 1000);

async function main() {
  // Clear old demo data (children first because of foreign keys).
  await prisma.priorityOverride.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.requestPhoto.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();

  // Restart ids at 1 so the demo data always has the same ids
  // (the Postman collection relies on unit 4 and property 1).
  for (const table of ["PriorityOverride", "StatusHistory", "RequestPhoto", "MaintenanceRequest", "Unit", "Property", "User"]) {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
  }

  const passwordHash = await bcrypt.hash("Password123", 10);

  const landlord = await prisma.user.create({
    data: { name: "Grace Wanjiru", email: "landlord@tms.test", phone: "0712000001", passwordHash, role: "LANDLORD" },
  });

  const tenants = [];
  for (const [name, email, phone] of [
    ["Brian Otieno", "brian@tms.test", "0712000002"],
    ["Faith Chebet", "faith@tms.test", "0712000003"],
    ["Kevin Mwangi", "kevin@tms.test", "0712000004"],
  ]) {
    tenants.push(await prisma.user.create({ data: { name, email, phone, passwordHash, role: "TENANT" } }));
  }

  const property = await prisma.property.create({
    data: { name: "Kimathi Court", location: "Nyeri, Kamakwa Road", landlordId: landlord.id },
  });

  const units = [];
  for (const [i, label] of ["A1", "A2", "B1", "B2"].entries()) {
    units.push(
      await prisma.unit.create({
        data: { label, propertyId: property.id, tenantId: tenants[i]?.id ?? null },
      }),
    );
  }

  const samples = [
    {
      t: 0, title: "Water leaking from ceiling", category: "PLUMBING", locationInUnit: "bathroom",
      description: "Water is dripping from the bathroom ceiling near the light fitting since morning.",
      priority: "HIGH", aiPriority: "HIGH", aiConfidence: 0.91, prioritySource: "AI", status: "SUBMITTED", ago: 2,
    },
    {
      t: 1, title: "Kitchen socket sparks", category: "ELECTRICAL", locationInUnit: "kitchen",
      description: "The socket next to the fridge sparks when I plug in the kettle.",
      priority: "HIGH", aiPriority: "HIGH", aiConfidence: 0.87, prioritySource: "AI", status: "ASSIGNED", ago: 20,
    },
    {
      t: 2, title: "Wardrobe door hinge loose", category: "OTHER", locationInUnit: "bedroom",
      description: "The left wardrobe door hinge is loose and the door does not close well.",
      priority: "LOW", aiPriority: "LOW", aiConfidence: 0.78, prioritySource: "AI", status: "IN_PROGRESS", ago: 70,
    },
    {
      t: 0, title: "Front door lock stiff", category: "SECURITY", locationInUnit: "front door",
      description: "The main door lock is very stiff and sometimes the key does not turn.",
      priority: "HIGH", aiPriority: "MEDIUM", aiConfidence: 0.55, prioritySource: "LANDLORD", status: "RESOLVED", ago: 120,
    },
  ];

  for (const s of samples) {
    const tenant = tenants[s.t];
    const unit = units[s.t];
    const req = await prisma.maintenanceRequest.create({
      data: {
        clientId: randomUUID(),
        title: s.title,
        description: s.description,
        category: s.category,
        locationInUnit: s.locationInUnit,
        status: s.status,
        priority: s.priority,
        aiPriority: s.aiPriority,
        aiConfidence: s.aiConfidence,
        prioritySource: s.prioritySource,
        tenantId: tenant.id,
        unitId: unit.id,
        reportedAt: hours(s.ago),
        resolvedAt: s.status === "RESOLVED" ? hours(s.ago - 24) : null,
      },
    });

    // Status timeline up to the current status.
    const flow = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];
    const upTo = flow.indexOf(s.status);
    for (let i = 0; i <= upTo; i++) {
      await prisma.statusHistory.create({
        data: {
          requestId: req.id,
          fromStatus: i === 0 ? null : flow[i - 1],
          toStatus: flow[i],
          changedById: i === 0 ? tenant.id : landlord.id,
        },
      });
    }

    if (s.prioritySource === "LANDLORD") {
      await prisma.priorityOverride.create({
        data: {
          requestId: req.id,
          fromPriority: s.aiPriority,
          toPriority: s.priority,
          reason: "Tenant could be locked out, treat as urgent",
          changedById: landlord.id,
        },
      });
    }
  }

  console.log("Seeded: 1 landlord, 3 tenants, 1 property, 4 units, 4 requests");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
