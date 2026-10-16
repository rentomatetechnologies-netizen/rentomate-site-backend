import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { config } from "./config";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { routes } from "./routes";

export function createApp() {
  const app = express();

  // The website proxies /api/* and /media/* here; trust it (and Docker/private networks) for the client IP.
  app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  // No CORS: browsers only reach this API through the website's same-origin proxy.

  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
