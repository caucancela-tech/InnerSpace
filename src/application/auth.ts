import { db, type InnerSpaceDatabase, type Owner } from "../infrastructure/database";
import { invariant } from "./errors";
import { defaultPreferences } from "./privacy";

const ITERATIONS = 600_000;
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const unhex = (value: string) =>
  Uint8Array.from(value.match(/../g) || [], (byte) => parseInt(byte, 16));
async function derive(password: string, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", iterations, salt: unhex(salt) },
        key,
        256,
      ),
    ),
  );
}
function validatePassword(password: string) {
  invariant(
    password.length >= 12 && password.length <= 200,
    "Usa una contraseña de entre 12 y 200 caracteres, preferiblemente una frase única.",
  );
}
const equal = (a: string, b: string) => {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
};
export class AuthService {
  private channel: BroadcastChannel | undefined;
  private lastActivity = 0;
  private startedAt = 0;
  private unlocked = false;
  private timeoutMinutes = 10;
  private listeners = new Set<() => void>();
  private state: "locked" | "active" | "expired" = "locked";
  constructor(
    private database: InnerSpaceDatabase = db,
    private now = () => Date.now(),
  ) {
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(`innerspace-admin-${database.name}`);
      this.channel.onmessage = (event) => {
        if (event.data === "credentials-changed") {
          this.unlocked = false;
          this.emit("locked");
        }
      };
    }
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.state;
  private emit(state: typeof this.state) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  private async begin() {
    this.timeoutMinutes = (await this.database.appSettings.get("system"))?.autoLockMinutes || 10;
    this.lastActivity = this.startedAt = this.now();
    this.unlocked = true;
    this.emit("active");
  }
  async setup(name: string, password: string) {
    invariant(
      name.trim().length >= 2 && name.trim().length <= 80,
      "El nombre debe tener entre 2 y 80 caracteres.",
    );
    validatePassword(password);
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const passwordHash = await derive(password, salt, ITERATIONS);
    const now = new Date().toISOString();
    await this.database.transaction(
      "rw",
      [
        this.database.users,
        this.database.preferences,
        this.database.appSettings,
        this.database.databaseMetadata,
        this.database.auditEvents,
      ],
      async () => {
        invariant(
          !(await this.database.users.get("root")),
          "El propietario ya está configurado. No se puede crear otro.",
        );
        await this.database.users.add({
          id: "root",
          name: name.trim(),
          salt,
          passwordHash,
          iterations: ITERATIONS,
          createdAt: now,
          updatedAt: now,
          failedAttempts: 0,
          lockedUntil: 0,
        });
        await this.database.preferences.add(defaultPreferences);
        await this.database.appSettings.add({
          id: "system",
          autoLockMinutes: 10,
          requestDurableStorage: false,
        });
        await this.database.databaseMetadata.put({
          id: "initialized",
          value: now,
          updatedAt: now,
        });
        await this.log("Propietario local creado");
      },
    );
    await this.begin();
  }
  private async verify(password: string): Promise<Owner> {
    const owner = await this.database.users.get("root");
    invariant(owner, "Primero configura al propietario.");
    invariant(
      owner.lockedUntil <= this.now(),
      "Demasiados intentos. Espera un minuto antes de volver a intentarlo.",
    );
    const hash = await derive(password, owner.salt, owner.iterations);
    if (!equal(hash, owner.passwordHash)) {
      await this.database.transaction(
        "rw",
        [this.database.users, this.database.auditEvents],
        async () => {
          const current = (await this.database.users.get("root"))!;
          const failedAttempts = current.failedAttempts + 1;
          await this.database.users.update("root", {
            failedAttempts,
            lockedUntil: failedAttempts >= 5 ? this.now() + 60_000 : 0,
          });
          await this.log("Intento de acceso rechazado");
        },
      );
      throw new Error("Contraseña incorrecta.");
    }
    // Do not let a concurrent password change authorize an obsolete credential.
    invariant(
      (await this.database.users.get("root"))?.passwordHash === hash,
      "Las credenciales han cambiado. Vuelve a iniciar sesión.",
    );
    await this.database.users.update("root", {
      failedAttempts: 0,
      lockedUntil: 0,
    });
    return owner;
  }
  async login(password: string) {
    await this.verify(password);
    await this.log("Acceso administrativo iniciado");
    await this.begin();
  }
  touch() {
    if (this.valid()) this.lastActivity = this.now();
  }
  valid() {
    if (
      this.unlocked &&
      (this.now() - this.lastActivity >= this.timeoutMinutes * 60_000 ||
        this.now() - this.startedAt >= 8 * 60 * 60_000)
    ) {
      this.unlocked = false;
      this.emit("expired");
      void this.log("Sesión administrativa expirada").catch(() => {});
    }
    return this.unlocked;
  }
  assert() {
    invariant(
      this.valid(),
      "Sesión administrativa bloqueada o expirada. Desbloquea para continuar.",
    );
  }
  async lock() {
    this.unlocked = false;
    this.emit("locked");
    await this.log("Sesión administrativa cerrada");
  }
  async changePassword(current: string, next: string) {
    this.assert();
    validatePassword(next);
    const old = await this.verify(current);
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const passwordHash = await derive(next, salt, ITERATIONS);
    this.assert();
    await this.database.transaction(
      "rw",
      [this.database.users, this.database.auditEvents],
      async () => {
        invariant(
          (await this.database.users.get("root"))?.passwordHash === old.passwordHash,
          "La contraseña cambió en otra pestaña.",
        );
        await this.database.users.update("root", {
          salt,
          passwordHash,
          iterations: ITERATIONS,
          updatedAt: new Date().toISOString(),
        });
        await this.log("Contraseña modificada");
      },
    );
    this.channel?.postMessage("credentials-changed");
    await this.lock().catch(() => {});
  }
  async setTimeout(minutes: number) {
    this.assert();
    invariant(
      Number.isInteger(minutes) && minutes >= 1 && minutes <= 60,
      "El bloqueo debe estar entre 1 y 60 minutos.",
    );
    await this.database.appSettings.update("system", {
      autoLockMinutes: minutes,
    });
    this.timeoutMinutes = minutes;
    await this.log("Bloqueo automático actualizado");
  }
  async log(action: string) {
    await this.database.auditEvents.add({
      id: crypto.randomUUID(),
      action,
      createdAt: new Date().toISOString(),
    });
  }
}
export const auth = new AuthService();
