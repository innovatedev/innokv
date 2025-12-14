/// <reference lib="deno.unstable" />
import { App, staticFiles } from "fresh";
import { type State } from "./utils.ts";
import { session } from "./config/session.ts";

export const app = new App<State>();

app.use(staticFiles());

app.use(session);

// Include file-system based routes here
app.fsRoutes();
