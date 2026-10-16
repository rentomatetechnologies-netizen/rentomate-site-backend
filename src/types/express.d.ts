declare global {
  namespace Express {
    interface Request {
      /** Set by requireAdmin for authenticated requests. */
      admin?: { id: number; username: string; sessionHash: string };
    }
  }
}

export {};
