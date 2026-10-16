import type { Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../lib/http-error";
import { parseId } from "../lib/params";
import { currentAdmin } from "../middleware/require-admin";
import * as adminsService from "../services/admins.service";

const createSchema = z.object({ username: z.string().max(100), password: z.string().max(500) });

export async function list(_req: Request, res: Response) {
  res.json(await adminsService.listAdmins());
}

export async function create(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Enter a username and password.");
  res.status(201).json(await adminsService.createAdmin(parsed.data.username, parsed.data.password));
}

export async function remove(req: Request<{ id: string }>, res: Response) {
  await adminsService.deleteAdmin(parseId(req.params.id), currentAdmin(req).id);
  res.json({ ok: true });
}
