import type { Request, Response } from "express";
import { parseId } from "../lib/params";
import * as postsService from "../services/posts.service";
import { postInputSchema } from "../validation/post.schema";

export async function list(_req: Request, res: Response) {
  res.json(await postsService.listPosts());
}

export async function get(req: Request<{ id: string }>, res: Response) {
  res.json(await postsService.getPost(parseId(req.params.id)));
}

export async function create(req: Request, res: Response) {
  const input = postInputSchema.parse(req.body);
  res.status(201).json(await postsService.createPost(input));
}

export async function update(req: Request<{ id: string }>, res: Response) {
  const id = parseId(req.params.id);
  const input = postInputSchema.parse(req.body);
  res.json(await postsService.updatePost(id, input));
}

export async function remove(req: Request<{ id: string }>, res: Response) {
  await postsService.deletePost(parseId(req.params.id));
  res.json({ ok: true });
}

export async function dashboard(_req: Request, res: Response) {
  res.json(await postsService.getDashboard());
}

/* public */

export async function listPublished(_req: Request, res: Response) {
  res.json(await postsService.listPublishedPosts());
}

export async function getPublished(req: Request<{ slug: string }>, res: Response) {
  res.json(await postsService.getPublishedPost(req.params.slug));
}
