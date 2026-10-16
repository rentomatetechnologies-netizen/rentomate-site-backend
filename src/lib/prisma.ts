import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "../config";
import { PrismaClient } from "../generated/prisma/client";

// The only database connection in the whole system: the website goes through this API.
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
