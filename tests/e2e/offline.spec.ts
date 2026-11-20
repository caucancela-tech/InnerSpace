import { test, expect, chromium } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let server: Server;
let origin: string;
test.beforeAll(async () => {
  // Static production artifact only; never starts another Vite/development server.
  const root = path.resolve("dist");
  server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    let filename = path.resolve(root, `.${pathname}`);
    if (!filename.startsWith(root + path.sep) && filename !== root) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (!path.extname(filename)) filename = path.join(root, "index.html");
    const mime: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".woff2": "font/woff2",
      ".jpg": "image/jpeg",
      ".webmanifest": "application/manifest+json",
    };
    try {
      const data = await readFile(filename);
      response.writeHead(200, {
        "Content-Type": mime[path.extname(filename)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Sin dirección de servidor estático");
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("producción inicia sin internet y conserva IndexedDB después de cerrar y reabrir el navegador", async () => {
  const profile = await mkdtemp(path.join(tmpdir(), "innerspace-profile-"));
  const launch = () =>
    chromium.launchPersistentContext(profile, {
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
  let context = await launch();
  try {
    let page = await context.newPage();
    const external: string[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith("http") && !request.url().startsWith(origin))
        external.push(request.url());
    });
    await page.goto(origin);
    await page.getByLabel("Tu nombre", { exact: true }).fill("Local");
    await page
      .getByLabel("Contraseña administrativa", { exact: true })
      .fill("frase local para pruebas");
    await page.getByLabel("Repite la contraseña", { exact: true }).fill("frase local para pruebas");
    await page.getByRole("button", { name: "Crear mi espacio local" }).click();
    await expect(
      page.getByRole("heading", { name: /Buenos días|Buenas tardes|Buenas noches/ }),
    ).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.goto(`${origin}/diario/nueva`);
    await page.getByLabel("Contenido de la entrada").fill("Este texto vive sin internet.");
    await page.getByRole("button", { name: "Guardar entrada", exact: true }).click();
    await expect(page).toHaveURL(/\/diario\/(?!nueva)/);
    const entryUrl = page.url();
    expect(external).toEqual([]);
    await context.close();
    context = await launch();
    await context.setOffline(true);
    page = await context.newPage();
    await page.goto(entryUrl);
    await expect(page.getByLabel("Contenido de la entrada")).toHaveValue(
      "Este texto vive sin internet.",
    );
    await page.getByLabel("Contenido de la entrada").fill("Editado sin conexión.");
    await page.getByRole("button", { name: "Guardar entrada", exact: true }).click();
    await expect(page.getByText("Guardado en el dispositivo", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Contenido de la entrada")).toHaveValue("Editado sin conexión.");
    await page.goto(`${origin}/administracion`);
    await expect(page.getByRole("button", { name: "Desbloquear administración" })).toBeVisible();
    await page.screenshot({ path: "/tmp/innerspace-offline.png", fullPage: true });
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
