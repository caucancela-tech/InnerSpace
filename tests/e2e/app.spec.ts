import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { schemaV1 } from "../../src/infrastructure/database";

const password = "mi frase privada para pruebas";
const photo = path.resolve("public/images/forest.jpg");
async function setup(page: Page) {
  await page.goto("/");
  await page.getByLabel("Tu nombre", { exact: true }).fill("Propietaria");
  await page.getByLabel("Contraseña administrativa", { exact: true }).fill(password);
  await page.getByLabel("Repite la contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear mi espacio local" }).click();
  await expect(
    page.getByRole("heading", { name: /Buenos días|Buenas tardes|Buenas noches/ }),
  ).toBeVisible();
}
async function unlock(page: Page) {
  await page.goto("/administracion");
  const input = page.getByLabel("Contraseña administrativa", { exact: true });
  await input.fill(password);
  await page.getByRole("button", { name: "Desbloquear administración" }).click();
  await expect(page.getByText("Sin inconsistencias detectadas")).toBeVisible();
}
async function createEntry(page: Page) {
  await page.goto("/diario/nueva?fecha=2026-06-15");
  await page.getByLabel("Título opcional").fill("Mi recuerdo de prueba");
  await page.getByLabel("Contenido de la entrada").fill("Una tarde que quiero conservar.");
  await page.getByLabel("Etiquetas", { exact: true }).fill("Calma, Naturaleza");
  await page.getByRole("button", { name: "En calma", exact: true }).click();
  await page.getByRole("button", { name: "Energía 4 de 5" }).click();
  await page.getByLabel("Nueva actividad personal").fill("Pasear");
  await page.getByRole("button", { name: "Añadir actividad" }).click();
  await expect(page.getByRole("button", { name: "Pasear", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByLabel("Acontecimiento significativo").fill("Una tarde especial");
  await page.getByLabel("Archivos adjuntos").setInputFiles(photo);
  await page.getByRole("button", { name: "Guardar entrada", exact: true }).click();
  await expect(page).toHaveURL(/\/diario\/(?!nueva)/);
  await expect(page.getByText("Guardado en el dispositivo", { exact: true })).toBeVisible();
}
async function countDatabase(page: Page, table: string) {
  return page.evaluate(async (name) => {
    const request = indexedDB.open("InnerSpace");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const count = await new Promise<number>((resolve, reject) => {
      const query = database.transaction(name).objectStore(name).count();
      query.onsuccess = () => resolve(query.result);
      query.onerror = () => reject(query.error);
    });
    database.close();
    return count;
  }, table);
}

test("flujo real: diario → IndexedDB → recarga, calendario, línea temporal, recuerdos, búsqueda y eliminación coherente", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await setup(page);
  await expect.poll(() => countDatabase(page, "journalEntries")).toBe(0);
  await createEntry(page);
  const url = page.url();
  await page.reload();
  await expect(page.getByLabel("Contenido de la entrada")).toHaveValue(
    "Una tarde que quiero conservar.",
  );
  await expect(page.getByRole("button", { name: "En calma", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await countDatabase(page, "mediaBlobs")).toBe(1);
  await page.goto("/calendario?fecha=2026-06-15");
  await expect(page.getByRole("heading", { name: "Mi recuerdo de prueba" })).toBeVisible();
  await page.getByRole("button", { name: "Mes anterior" }).click();
  await expect(page.getByRole("heading", { name: "mayo de 2026" })).toBeVisible();
  await page.goto("/linea-temporal");
  await expect(page.getByRole("heading", { name: "Una tarde especial" })).toBeVisible();
  await page.goto("/recuerdos");
  await expect(page.getByRole("heading", { name: "forest.jpg" })).toBeVisible();
  await page.getByRole("button", { name: /forest.jpg/ }).click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: /Mi recuerdo de prueba/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.goto("/diario");
  await page.getByRole("textbox", { name: "Buscar en el diario" }).fill("TARDE");
  await expect(page.locator(".journal-row")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Buscar en el diario" }).fill("inexistente");
  await expect(page.locator(".journal-row")).toHaveCount(0);
  await page.goto(url);
  await page.getByLabel("Contenido de la entrada").fill("Editado y conservado.");
  await page.getByRole("button", { name: "Guardar entrada", exact: true }).click();
  await expect(page.getByText("Guardado en el dispositivo", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Contenido de la entrada")).toHaveValue("Editado y conservado.");
  await page.getByRole("button", { name: "Eliminar entrada", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(page).toHaveURL(/\/diario$/);
  expect(await countDatabase(page, "journalEntries")).toBe(0);
  expect(await countDatabase(page, "moodRecords")).toBe(0);
  expect(await countDatabase(page, "activityRecords")).toBe(0);
  expect(await countDatabase(page, "mediaBlobs")).toBe(1);
  await unlock(page);
  expect(failures).toEqual([]);
});

test("registros breves, reflexiones parciales, borradores, temas, responsive y accesibilidad", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/registro");
  await page.getByRole("button", { name: "Con alegría", exact: true }).click();
  await page.getByRole("button", { name: "Energía 2 de 5" }).click();
  await page.getByLabel("Algo de contexto, si quieres").fill("Hoy me di un espacio.");
  await page.getByRole("button", { name: "Guardar registro", exact: true }).click();
  await expect(
    page.getByText("Registro guardado en el dispositivo. Puedes editarlo aquí."),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Algo de contexto, si quieres")).toHaveValue(
    "Hoy me di un espacio.",
  );
  await page.getByRole("button", { name: "Energía 5 de 5" }).click();
  await page.getByRole("button", { name: "Actualizar registro", exact: true }).click();
  await expect.poll(() => countDatabase(page, "energyRecords")).toBe(1);
  await page.goto("/reflexiones");
  await page
    .getByLabel("¿Qué momento de esta semana quiero recordar?", { exact: true })
    .fill("Un momento pequeño.");
  await page.getByRole("button", { name: "Guardar reflexión", exact: true }).click();
  await expect(page.getByText("Reflexión parcial guardada en el dispositivo.")).toBeVisible();
  await page.reload();
  await page.locator(".reflection-saved").click();
  await expect(
    page.getByLabel("¿Qué momento de esta semana quiero recordar?", { exact: true }),
  ).toHaveValue("Un momento pequeño.");
  await expect(page.locator(".reflection-question")).toHaveCount(5);
  await page.goto("/diario/nueva");
  await page.getByLabel("Contenido de la entrada").fill("Borrador para mañana.");
  await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
  await expect(page).toHaveURL(/\/diario\/(?!nueva)/);
  await page.reload();
  await expect(page.getByLabel("Contenido de la entrada")).toHaveValue("Borrador para mañana.");
  await page.goto("/configuracion");
  await page.getByRole("button", { name: "Oscuro", exact: true }).click();
  await expect(page.locator(".app")).toHaveClass(/dark/);
  await page.getByLabel("Texto más grande").click();
  await expect(page.getByLabel("Texto más grande")).toBeChecked();
  await expect(page.locator(".app")).toHaveClass(/large-text/);
  await page.reload();
  await expect(page.locator(".app")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Automático", exact: true }).click();
  await expect(page.locator(".app")).toHaveClass(/auto-theme/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() =>
      page.locator(".app").evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe("rgb(23, 26, 31)");
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByRole("button", { name: "Claro", exact: true }).click();
  await expect(page.locator(".app")).not.toHaveClass(/auto-theme|dark/);
  await page.getByLabel("Reducir movimiento").click();
  await expect(page.locator(".app")).toHaveClass(/reduce-motion/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((issue) => ({
      id: issue.id,
      nodes: issue.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation", { name: "Navegación móvil" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "/tmp/innerspace-mobile.png", fullPage: true });
});

test("administración protegida, exportación e importación con binarios desde la interfaz", async ({
  page,
}) => {
  await setup(page);
  await createEntry(page);
  await unlock(page);
  await page.getByRole("button", { name: "Bloquear y cerrar sesión" }).click();
  await expect(page.getByRole("button", { name: "Desbloquear administración" })).toBeVisible();
  await page.getByLabel("Contraseña administrativa", { exact: true }).fill("incorrecta");
  await page.getByRole("button", { name: "Desbloquear administración" }).click();
  await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
  await page.getByLabel("Contraseña administrativa", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Desbloquear administración" }).click();
  await expect(page.getByText("Sin inconsistencias detectadas")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar respaldo completo" }).click();
  const download = await downloadPromise;
  const filename = await download.path();
  expect((await readFile(filename!)).length).toBeGreaterThan(1000);
  await page.goto("/diario");
  await page.locator(".journal-row").click();
  await page.getByRole("button", { name: "Eliminar entrada", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar", exact: true }).click();
  await unlock(page);
  await page.getByLabel("Seleccionar respaldo ZIP").setInputFiles(filename!);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Restaurar un respaldo validado" }),
  ).toBeVisible();
  await dialog.getByRole("checkbox").check();
  await dialog.getByLabel("Escribe RESTAURAR para confirmar").fill("RESTAURAR");
  await dialog.getByRole("button", { name: "Reemplazar y restaurar" }).click();
  await expect(page.getByText(/Restauración completada/)).toBeVisible();
  expect(await countDatabase(page, "journalEntries")).toBe(1);
  expect(await countDatabase(page, "mediaBlobs")).toBe(1);
  await page.goto("/recuerdos");
  await expect(page.getByRole("heading", { name: "forest.jpg" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "forest.jpg" })).toBeVisible();
  await page.goto("/administracion");
  await expect(page.getByRole("button", { name: "Desbloquear administración" })).toBeVisible();
});

test("catálogo y acontecimientos independientes, cambio de contraseña y expiración administrativa", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/configuracion");
  await page.getByLabel("Nombre de actividad", { exact: true }).fill("Yoga");
  await page.getByLabel("Categoría", { exact: true }).fill("Movimiento");
  await page.getByRole("button", { name: "Crear actividad", exact: true }).click();
  await page.getByRole("button", { name: "Editar Yoga", exact: true }).click();
  await page.getByLabel("Nombre de actividad", { exact: true }).fill("Yoga suave");
  await page.getByRole("button", { name: "Actualizar actividad", exact: true }).click();
  await page.getByRole("button", { name: "Eliminar Yoga suave", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect(page.getByRole("button", { name: "Editar Yoga suave", exact: true })).toHaveCount(0);
  await page.goto("/linea-temporal");
  await page.getByRole("button", { name: "Nuevo acontecimiento" }).click();
  const eventDialog = page.getByRole("dialog");
  await eventDialog.getByLabel("Título del acontecimiento").fill("Un comienzo independiente");
  await eventDialog
    .getByLabel("Lo que quieres recordar")
    .fill("No necesita una entrada de diario.");
  await eventDialog.getByRole("button", { name: "Guardar acontecimiento" }).click();
  await expect(page.getByRole("heading", { name: "Un comienzo independiente" })).toBeVisible();
  await page.goto("/calendario");
  await page.getByLabel("Filtrar calendario").selectOption("Con acontecimientos");
  await expect(page.getByRole("heading", { name: "Un comienzo independiente" })).toBeVisible();
  await page.goto("/linea-temporal");
  await page.getByRole("button", { name: "Editar acontecimiento" }).click();
  await eventDialog.getByLabel("Título del acontecimiento").fill("Un comienzo revisado");
  await eventDialog.getByRole("button", { name: "Guardar acontecimiento" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Un comienzo revisado" })).toBeVisible();
  await page.getByRole("button", { name: "Eliminar acontecimiento" }).click();
  await eventDialog.getByRole("button", { name: "Confirmar eliminación" }).click();
  await expect.poll(() => countDatabase(page, "lifeEvents")).toBe(0);
  await unlock(page);
  await page.getByLabel("Bloqueo automático por inactividad").selectOption("1");
  await expect(page.getByText("Bloqueo automático actualizado.", { exact: true })).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(61_000);
  await expect(page.getByRole("heading", { name: "Tu sesión ha expirado" })).toBeVisible();
  await page.getByLabel("Contraseña administrativa", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Desbloquear administración" }).click();
  const otherTab = await page.context().newPage();
  await otherTab.goto("/administracion");
  await otherTab.getByLabel("Contraseña administrativa", { exact: true }).fill(password);
  await otherTab.getByRole("button", { name: "Desbloquear administración" }).click();
  await expect(otherTab.getByText("Sin inconsistencias detectadas")).toBeVisible();
  await page.getByLabel("Contraseña actual", { exact: true }).fill(password);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("otra frase personal segura");
  await page
    .getByLabel("Repite la nueva contraseña", { exact: true })
    .fill("otra frase personal segura");
  await page.getByRole("button", { name: "Cambiar contraseña y cerrar sesión" }).click();
  await expect(otherTab.getByRole("button", { name: "Desbloquear administración" })).toBeVisible();
  await otherTab.close();
  await page.getByLabel("Contraseña administrativa", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Desbloquear administración" }).click();
  await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
  await page
    .getByLabel("Contraseña administrativa", { exact: true })
    .fill("otra frase personal segura");
  await page.getByRole("button", { name: "Desbloquear administración" }).click();
  await expect(page.getByText("Sin inconsistencias detectadas")).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(scan.violations.map((issue) => issue.id)).toEqual([]);
  await page.screenshot({ path: "/tmp/innerspace-administration.png", fullPage: true });
});

test("migración v1 a v2 en IndexedDB nativo del navegador sin perder entradas ni binarios", async ({
  page,
}) => {
  await page.goto("/images/forest.jpg");
  const bytes = Array.from(await readFile(photo));
  await page.evaluate(
    async ({ schema, bytes }) => {
      const request = indexedDB.open("InnerSpace", 10); // Dexie v1 uses native IndexedDB version 10.
      request.onupgradeneeded = () => {
        for (const [name, definition] of Object.entries(schema)) {
          const store = request.result.createObjectStore(name, { keyPath: "id" });
          for (const token of definition
            .split(",")
            .slice(1)
            .map((value) => value.trim())) {
            const key = token.replace(/^[&*]+/, "");
            const path = key.startsWith("[") ? key.slice(1, -1).split("+") : key;
            store.createIndex(key, path, {
              unique: token.includes("&"),
              multiEntry: token.includes("*"),
            });
          }
        }
      };
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = database.transaction(["journalEntries", "mediaAssets", "mediaBlobs"], "readwrite");
      const now = new Date().toISOString();
      tx.objectStore("journalEntries").add({
        id: "legacy",
        title: "Antes de la migración",
        content: "Mi historia ya existía.",
        entryDate: "2026-06-15",
        createdAt: now,
        updatedAt: now,
        status: "saved",
        tags: [],
        activityReferences: [],
        mediaReferences: ["legacy-photo"],
      });
      tx.objectStore("mediaAssets").add({
        id: "legacy-photo",
        mediaType: "photo",
        filename: "forest.jpg",
        mimeType: "image/jpeg",
        size: bytes.length,
        createdAt: now,
      });
      tx.objectStore("mediaBlobs").add({
        id: "legacy-photo",
        blob: new Blob([Uint8Array.from(bytes)], { type: "image/jpeg" }),
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      database.close();
    },
    { schema: schemaV1, bytes },
  );
  await setup(page);
  await page.goto("/diario/legacy");
  await expect(page.getByLabel("Contenido de la entrada")).toHaveValue("Mi historia ya existía.");
  await expect(page.locator(".attachment-preview")).toBeVisible();
  await unlock(page);
  await expect(page.getByText("Sin inconsistencias detectadas")).toBeVisible();
  await page.getByText("Migraciones aplicadas", { exact: true }).click();
  await expect(page.getByText(/v2 · Índice y fecha de modificación de archivos/)).toBeVisible();
});

test("un fallo de cuota no confirma guardado ni pierde el texto; permite reintentar", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/diario/nueva");
  await page.getByLabel("Contenido de la entrada").fill("No quiero perder estas palabras.");
  await page.getByLabel("Archivos adjuntos").setInputFiles({
    name: "invalido.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(page.getByRole("alert").filter({ hasText: /Archivo inválido/ })).toBeVisible();
  await page.evaluate(() => {
    const previous = IDBObjectStore.prototype.put;
    (window as unknown as { restoreIDB: () => void }).restoreIDB = () => {
      IDBObjectStore.prototype.put = previous;
    };
    Object.defineProperty(IDBObjectStore.prototype, "put", {
      configurable: true,
      writable: true,
      value: function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        if (this.name === "journalEntries")
          throw new DOMException("Cuota de prueba", "QuotaExceededError");
        return key === undefined ? previous.call(this, value) : previous.call(this, value, key);
      },
    });
  });
  await page.getByRole("button", { name: "Guardar entrada", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /No queda espacio/ })
      .first(),
  ).toBeVisible();
  await expect(page.getByLabel("Contenido de la entrada")).toHaveValue(
    "No quiero perder estas palabras.",
  );
  await expect(page.getByText("Guardado en el dispositivo", { exact: true })).toHaveCount(0);
  expect(await countDatabase(page, "journalEntries")).toBe(0);
  await page.evaluate(() => (window as unknown as { restoreIDB: () => void }).restoreIDB());
  await page.getByRole("button", { name: "Guardar entrada", exact: true }).click();
  await expect(page.getByText("Guardado en el dispositivo", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Contenido de la entrada")).toHaveValue(
    "No quiero perder estas palabras.",
  );
});
